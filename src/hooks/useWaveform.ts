import { useState, useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";

export interface WaveformData {
  data: Float32Array;
  sampleRate: number;
}

export type WaveformStatus = "idle" | "loading" | "ready" | "error";

// Raw decoded audio as mixed-to-mono Float32 samples plus a status flag so the
// UI can tell "still decoding" apart from "not (yet) available".
export function useWaveform(url: string | null): { data: WaveformData | null; status: WaveformStatus } {
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [status, setStatus] = useState<WaveformStatus>("idle");
  const urlRef = useRef(url);

  // Keep ref in sync with latest url value
  useEffect(() => {
    urlRef.current = url;
  });

  // Decode audio and keep raw mono samples when url changes
  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setWaveform(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");

    let cancelled = false;

    async function load() {
      try {
        const { buffer: audioBuffer } = await decodeAudioBuffer(currentUrl!);

        const channelCount = audioBuffer.numberOfChannels;
        const length = audioBuffer.getChannelData(0).length;
        const mono = new Float32Array(length);
        for (let c = 0; c < channelCount; c++) {
          const channel = audioBuffer.getChannelData(c);
          for (let i = 0; i < length; i++) mono[i] += channel[i];
        }
        for (let i = 0; i < length; i++) mono[i] /= channelCount;

        if (cancelled) return;
        setWaveform({ data: mono, sampleRate: audioBuffer.sampleRate });
        setStatus("ready");
      } catch {
        if (cancelled) return;
        setWaveform(null);
        setStatus("error");
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { data: status === "ready" ? waveform : null, status };
}
