import { useState, useEffect, useRef } from "react";

// Amplitude below this value is treated as silence and suppressed
const SILENCE_THRESHOLD = 0.02;

// Number of amplitude peaks to extract per second of audio
const SAMPLES_PER_SECOND = 50;

/**
 * Extracts amplitude waveform peaks from an audio file URL.
 * Returns an array of normalized peak values (0-1) for rendering a waveform visualization.
 */
export function useWaveform(url: string | null) {
  const [peaks, setPeaks] = useState<number[]>([]);
  const urlRef = useRef(url);

  // Keep ref in sync with latest url value
  useEffect(() => {
    urlRef.current = url;
  });

  // Decode audio and extract peaks when url changes
  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) return;

    let cancelled = false;

    async function extractPeaks() {
      try {
        // Decode audio file into PCM samples (raw digital audio data).
        // Each sample is a float between -1.0 and 1.0 representing waveform amplitude at a point in time.
        const response = await fetch(currentUrl!);
        const arrayBuffer = await response.arrayBuffer();
        const audioContext = new AudioContext();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        await audioContext.close();

        if (cancelled) return;

        // Use first channel (mono) for peak extraction
        const channelData = audioBuffer.getChannelData(0);
        const duration = audioBuffer.duration;

        // Calculate how many peaks we need and how many raw samples per peak
        const totalSamples = Math.floor(duration * SAMPLES_PER_SECOND);
        const samplesPerPeak = Math.floor(channelData.length / totalSamples);
        const result: number[] = [];

        // For each time slot, find the maximum amplitude
        for (let i = 0; i < totalSamples; i++) {
          let max = 0;
          const start = i * samplesPerPeak;
          const end = Math.min(start + samplesPerPeak, channelData.length);
          for (let j = start; j < end; j++) {
            const abs = Math.abs(channelData[j]);
            if (abs > max) max = abs;
          }
          // Suppress silence: scale down low amplitude values
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
