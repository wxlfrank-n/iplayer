import { useState, useEffect, useRef } from "react";

const SILENCE_THRESHOLD = 0.02;
const SAMPLES_PER_SECOND = 50;

export function useWaveform(url: string | null) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const urlRef = useRef(url);

  useEffect(() => {
    urlRef.current = url;
  });

  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;

    let cancelled = false;

    async function extractPeaks() {
      try {
        const response = await fetch(currentUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        await audioContext.close();

        if (cancelled) return;

        const channelData = audioBuffer.getChannelData(0);
        const duration = audioBuffer.duration;
        const totalSamples = Math.floor(duration * SAMPLES_PER_SECOND);
        const samplesPerPeak = Math.floor(channelData.length / totalSamples);
        const result: number[] = [];

        for (let i = 0; i < totalSamples; i++) {
          let max = 0;
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          const suppressed = max < SILENCE_THRESHOLD ? max * 0.3 : max;
          result.push(suppressed);
        }

        setPeaks(result);
      } catch {
        setPeaks([]);
      }
    }

    extractPeaks();

    return () => {
      cancelled = true;
    };
  }, [url]);

  return peaks;
}
