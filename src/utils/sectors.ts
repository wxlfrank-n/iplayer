const SILENCE_THRESHOLD = 0.01;
// Peaks are sampled at 50 per second in useWaveform, so each peak covers exactly 0.02s.
const SEC_PER_PEAK = 0.02;
// Padding added before/after each sector to prevent missing start/end.
const SECTOR_PAD_SEC = 0.1;

// Detect sectors directly from the peaks array by scanning for non-silent runs.
export function detectSectors(
  peaks: number[],
): { start: number; end: number }[] {
  if (peaks.length === 0) return [];

  const raw: { start: number; end: number }[] = [];
  let inSound = false;
  let startIndex = 0;
  for (let i = 0; i <= peaks.length; i++) {
    const isSound = i < peaks.length && peaks[i] >= SILENCE_THRESHOLD;
    if (isSound && !inSound) {
      inSound = true;
      startIndex = i;
    } else if (!isSound && inSound) {
      inSound = false;
      raw.push({ start: startIndex * SEC_PER_PEAK, end: i * SEC_PER_PEAK });
    }
  }

  // Expand each sector by SECTOR_PAD_SEC before/after, clamped to valid range.
  const totalDuration = peaks.length * SEC_PER_PEAK;
  return raw.map((s) => ({
    start: Math.max(0, s.start - SECTOR_PAD_SEC),
    end: Math.min(totalDuration, s.end + SECTOR_PAD_SEC),
  }));
}