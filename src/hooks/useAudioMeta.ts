import { useState, useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";

export interface AudioMeta {
  channels: number;
  sampleRate: number;
  bitrate: number;
}

export function useAudioMeta(url: string | null) {
  const [meta, setMeta] = useState<AudioMeta | null>(null);
  const urlRef = useRef(url);

  useEffect(() => {
    urlRef.current = url;
  });

  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      setMeta(null);
      return;
    }

    let cancelled = false;

    async function extract() {
      try {
        // Reuse the same fetch + decodeAudioData that the waveform and playback
        // use, so the metadata never triggers a second full decode of the file.
        const { buffer, byteLength } = await decodeAudioBuffer(currentUrl!);
        if (cancelled) return;

        const bitrate = buffer.duration > 0
          ? Math.round((byteLength * 8) / buffer.duration / 1000)
          : 0;

        setMeta({
          channels: buffer.numberOfChannels,
          sampleRate: buffer.sampleRate,
          bitrate,
        });
      } catch {
        if (!cancelled) setMeta(null);
      }
    }

    extract();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return meta;
}
