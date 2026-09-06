import { useEffect, useState } from "react";
import { analyzeAudio, type Sector } from "../utils/vad";
import { detectSectors } from "../utils/sectors";

export type VadStatus = "idle" | "analyzing" | "ready" | "error";

// Runs Silero VAD on the current track and returns sentence sectors.
// Falls back to amplitude-based detection when VAD is unavailable.
// The hook is keyed by track URL (remounting per track), so `url` is stable.
export function useSectors(
  url: string | null,
  fallbackPeaks: number[],
): { sectors: Sector[]; status: VadStatus } {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [status, setStatus] = useState<VadStatus>(url ? "analyzing" : "idle");

  useEffect(() => {
    if (!url) return;

    let cancelled = false;

    analyzeAudio(url)
      .then((result) => {
        if (cancelled) return;
        setSectors(result);
        setStatus("ready");
      })
      .catch(() => {
        if (cancelled) return;
        setSectors(detectSectors(fallbackPeaks));
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [url, fallbackPeaks]);

  return { sectors, status };
}