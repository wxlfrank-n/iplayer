import { useState, useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";

export interface WaveformData {
  data: Float32Array;
  sampleRate: number;
}

// Returns the raw decoded audio as mixed-to-mono Float32 samples.
// The renderer downsamples these directly; nothing is extracted here.
export function useWaveform(url: string | null): WaveformData | null {
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const urlRef = useRef(url);

  // Keep ref in sync with latest url value
  useEffect(() => {
    urlRef.current = url;
  });

  // Decode audio and keep raw mono samples when url changes
  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;

    let cancelled = false;

    async function load() {
      try {
        const audioBuffer = await decodeAudioBuffer(currentUrl!);

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
      } catch {
        if (cancelled) return;
        setWaveform(null);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return waveform;
}