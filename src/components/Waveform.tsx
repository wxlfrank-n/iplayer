interface WaveformBarsProps {
  peaks: number[];
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  fracPlayed: number;
}

const SILENCE_THRESHOLD = 0.02;
const SEC_PER_PEAK = 0.02;

export function WaveformBars({
  peaks,
  windowStartSec,
  windowLen,
  innerH,
  vbW,
  vbH,
  fracPlayed,
}: WaveformBarsProps) {
  const bars: { x: number; y: number; w: number; h: number }[] = [];
  if (peaks.length > 0 && windowLen > 0) {
    const windowEndSec = windowStartSec + windowLen;
    const startPeak = windowStartSec / SEC_PER_PEAK;
    const endPeak = windowEndSec / SEC_PER_PEAK;
    const firstPeak = Math.max(0, Math.floor(startPeak));
    const lastPeak = Math.min(peaks.length, Math.ceil(endPeak));
    const n = Math.max(1, lastPeak - firstPeak);
    const stepW = vbW / n;

    for (let p = firstPeak; p < lastPeak; p++) {
      const amp = peaks[p] ?? 0;
      const amplitude = amp < SILENCE_THRESHOLD ? amp * 0.3 : amp;
      const barHeight = Math.max(1, amplitude * innerH);
      bars.push({
        x: (p - firstPeak) * stepW,
        y: (vbH - barHeight) / 2,
        w: Math.max(1, stepW - 0.5),
        h: barHeight,
      });
    }
  }

  const clipWidth = Math.max(fracPlayed * vbW, 1);

  return (
    <>
      <g>
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#30363d" />
        ))}
      </g>
      <g clipPath="url(#playedClip)">
        {bars.map((b, i) => (
          <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill="#58a6ff" />
        ))}
      </g>
      <defs>
        <clipPath id="playedClip">
          <rect x={0} y={0} width={clipWidth} height={vbH} />
        </clipPath>
      </defs>
    </>
  );
}