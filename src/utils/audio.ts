const decodeCache = new Map<string, Promise<AudioBuffer>>();

// Shared decode cache so waveform and VAD analysis decode each file only once.
export function decodeAudioBuffer(url: string): Promise<AudioBuffer> {
  const cached = decodeCache.get(url);
  if (cached) return cached;

  const pending = (async () => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch audio (${response.status})`);
    const arrayBuffer = await response.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      return await audioContext.decodeAudioData(arrayBuffer);
    } finally {
      await audioContext.close();
    }
  })();

  decodeCache.set(url, pending);
  pending.catch(() => decodeCache.delete(url));
  return pending;
}