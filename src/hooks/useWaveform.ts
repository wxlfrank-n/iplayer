/**
 * Decodes audio and stores waveform data in Redux.
 *
 * The decoded mono samples live in the `analysis` slice so all components can
 * read them; this hook owns the decode side effect and reports status.
 */

import { useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { setWaveform, setWaveformStatus } from "../store/analysisSlice";
import type { WaveformData, WaveformStatus } from "../types";

export type { WaveformData, WaveformStatus } from "../types";

// Raw decoded audio as mixed-to-mono Float32 samples plus a status flag so the
// UI can tell "still decoding" apart from "not (yet) available".
export function useWaveform(url: string | null): {
  data: WaveformData | null;
  status: WaveformStatus;
} {
  const dispatch = useAppDispatch();
  const waveform = useAppSelector((s) => s.analysis.waveform);
  const status = useAppSelector((s) => s.analysis.waveformStatus);
  const urlRef = useRef(url);

  // Keep ref in sync with latest url value
  useEffect(() => {
    urlRef.current = url;
  });

  // Decode audio and keep raw mono samples when url changes
  useEffect(() => {
    const currentUrl = urlRef.current;
    if (!currentUrl) {
      dispatch(setWaveform(null));
      dispatch(setWaveformStatus("idle"));
      return;
    }
    dispatch(setWaveformStatus("loading"));

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
        dispatch(
          setWaveform({ data: mono, sampleRate: audioBuffer.sampleRate }),
        );
        dispatch(setWaveformStatus("ready"));
      } catch {
        if (cancelled) return;
        dispatch(setWaveform(null));
        dispatch(setWaveformStatus("error"));
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [url, dispatch]);

  return { data: status === "ready" ? waveform : null, status };
}
