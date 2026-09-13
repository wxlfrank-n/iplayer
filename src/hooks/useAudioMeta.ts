/**
 * Extracts audio metadata (channels, sample rate, bitrate).
 *
 * Uses the decoded audio buffer to compute bitrate:
 * bitrate = (file_size_bytes * 8) / duration_seconds / 1000
 *
 * Reuses the shared decode cache so metadata extraction doesn't
 * trigger a second full decode of the file.
 */

import { useState, useEffect, useRef } from "react";
import { decodeAudioBuffer } from "../utils/audio";

/**
 * Audio metadata information.
 *
 * @property channels - Number of audio channels (1 = mono, 2 = stereo)
 * @property sampleRate - Sample rate in Hz (e.g., 44100, 48000)
 * @property bitrate - Bitrate in kbps (kilobits per second)
 */
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

        const bitrate =
          buffer.duration > 0
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
