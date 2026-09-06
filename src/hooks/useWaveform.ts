import { useState, useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";

// Number of amplitude peaks to extract per second of audio
const SAMPLES_PER_SECOND = 50;
// Blend weight for RMS so sustained passages stay visible next to loud transients
const RMS_WEIGHT = 2.2;
// Perceptual loudness curve: lifts quiet content toward visibility
const PERCEPTUAL_EXP = 0.6;
// Split-sample glitch guard: if peak is far beyond RMS, it is an isolated artifact
const TRANSIENT_RATIO = 12;
// Robust normalization target (99th percentile maps to ~1.0)
const NORMALIZE_PERCENTILE = 0.99;
// Relative-to-median RMS below which a bucket is treated as near-silence
const SILENCE_RATIO = 0.08;
// Centered smoothing window (odd), preserves index <-> time alignment
const SMOOTH_TAPS = 3;

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
        // Decode audio file into PCM samples (shared cache with VAD analysis).
        const audioBuffer = await decodeAudioBuffer(currentUrl!);

        if (cancelled) return;

        const channelCount = audioBuffer.numberOfChannels;
        const channelLength = audioBuffer.getChannelData(0).length;
        const totalBuckets = Math.max(
          1,
          Math.floor(audioBuffer.duration * SAMPLES_PER_SECOND),
        );
        const samplesPerBucket = Math.max(
          1,
          Math.floor(channelLength / totalBuckets),
        );

        // Phase-aware mono mix: accumulate signed samples, then derive peak/RMS.
        const mixed = new Float32Array(channelLength);
        for (let c = 0; c < channelCount; c++) {
          const data = audioBuffer.getChannelData(c);
          for (let i = 0; i < channelLength; i++) mixed[i] += data[i];
        }
        mixed.forEach((v, i) => {
          mixed[i] = v / channelCount;
        });

        // First pass: raw peak and RMS energy per bucket.
        const rawVals: number[] = new Array(totalBuckets).fill(0);
        const rmsVals: number[] = new Array(totalBuckets).fill(0);
        for (let b = 0; b < totalBuckets; b++) {
          const start = b * samplesPerBucket;
          const end = Math.min(start + samplesPerBucket, channelLength);
          let peak = 0;
          let sumSq = 0;
          const n = end - start;
          for (let i = start; i < end; i++) {
            const abs = Math.abs(mixed[i]);
            if (abs > peak) peak = abs;
            sumSq += mixed[i] * mixed[i];
          }
          const rms = n > 0 ? Math.sqrt(sumSq / n) : 0;

          // Glitch guard: an isolated sample spike far above the energy is not musical.
          if (rms > 0 && peak > TRANSIENT_RATIO * rms) {
            peak = rms * TRANSIENT_RATIO;
          }

          // Blend peak and RMS, then apply the perceptual curve.
          rawVals[b] = Math.pow(
            Math.min(1, Math.max(peak, rms * RMS_WEIGHT)),
            PERCEPTUAL_EXP,
          );
          rmsVals[b] = rms;
        }

        // Silence floor based on median RMS: near-silent buckets stay low.
        const sorted = [...rmsVals].sort((a, b) => a - b);
        const medianRms = sorted[Math.floor(sorted.length / 2)];
        const silenceFloor = medianRms * SILENCE_RATIO;
        for (let b = 0; b < totalBuckets; b++) {
          if (rmsVals[b] < silenceFloor && rawVals[b] > 0.01) {
            rawVals[b] = Math.min(rawVals[b], 0.05);
          }
        }

        // Robust normalization: 99th percentile maps to ~1.0 (soft files fill the bar).
        const sortedVals = [...rawVals].sort((a, b) => a - b);
        const p99 = sortedVals[Math.min(sortedVals.length - 1, Math.floor(sortedVals.length * NORMALIZE_PERCENTILE))];
        const scale = p99 > 0 ? 1 / p99 : 1;
        for (let b = 0; b < totalBuckets; b++) {
          rawVals[b] = Math.min(1, rawVals[b] * scale);
        }

        // Centered box smoothing to stabilise sector boundaries.
        const halfTap = Math.floor(SMOOTH_TAPS / 2);
        const result: number[] = new Array(totalBuckets).fill(0);
        for (let b = 0; b < totalBuckets; b++) {
          let sum = 0;
          let count = 0;
          for (let t = -halfTap; t <= halfTap; t++) {
            const idx = b + t;
            if (idx >= 0 && idx < totalBuckets) {
              sum += rawVals[idx];
              count++;
            }
          }
          result[b] = sum / count;
        }

        if (cancelled) return;
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