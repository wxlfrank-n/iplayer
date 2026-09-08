export interface DecodedAudio {
  buffer: AudioBuffer;
  byteLength: number;
}

const decodeCache = new Map<string, Promise<DecodedAudio>>();

// Shared decode cache so the metadata, waveform and playback (WAV) viewers all
// fetch + decode each file exactly once and share the result.
export function decodeAudioBuffer(url: string): Promise<DecodedAudio> {
  const cached = decodeCache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch audio (${response.status})`);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const buffer = await audioContext.decodeAudioData(arrayBuffer);
      return { buffer, byteLength: arrayBuffer.byteLength };
    } finally {
      await audioContext.close();
    }
  })();

  decodeCache.set(url, pending);
  pending.catch(() => decodeCache.delete(url));
  return pending;
}