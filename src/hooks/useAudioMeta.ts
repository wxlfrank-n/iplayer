import { useState, useEffect, useRef } from "react";

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
        const response = await fetch(currentUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const contentLength = response.headers.get("content-length");
        const fileSize = contentLength ? parseInt(contentLength, 10) : arrayBuffer.byteLength;

        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        await audioContext.close();

        if (cancelled) return;

        const bitrate = audioBuffer.duration > 0
          ? Math.round((fileSize * 8) / audioBuffer.duration / 1000)
          : 0;

        setMeta({
          channels: audioBuffer.numberOfChannels,
          sampleRate: audioBuffer.sampleRate,
          bitrate,
        });
      } catch {
        setMeta(null);
      }
    }

    extract();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return meta;
}
