import { useMemo } from "react";

const SILENCE_THRESHOLD = 0.02;
// Peaks are sampled at 50 per second in useWaveform, so each peak covers exactly 0.02s.
const SEC_PER_PEAK = 0.02;

interface SectorProps {
  peaks: number[];
  mergeSeconds: number;
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
}

// Detect merged sectors directly from the peaks array by scanning for non-silent runs.
function detectSectors(
  peaks: number[],
  mergeSeconds: number,
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

  const merged: { start: number; end: number }[] = [];
  for (const r of raw) {
    const prev = merged[merged.length - 1];
    if (prev && r.start - prev.end < mergeSeconds) {
      prev.end = r.end;
    } else {
      merged.push({ ...r });
    }
  }
  return merged;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Sector({ peaks, mergeSeconds, windowStartSec, windowLen, innerH, vbW, vbH, onPlayRange }: SectorProps) {
  const sectors = useMemo(
    () => detectSectors(peaks, mergeSeconds),
    [peaks, mergeSeconds],
  );

  const visibleSectors = sectors.filter((s) => s.end > windowStartSec && s.start < windowStartSec + windowLen);

  const handleClick = (e: React.MouseEvent<SVGRectElement>, start: number, end: number) => {
    e.stopPropagation();
    onPlayRange(start, end, 3);
  };

  return (
    <>
      {visibleSectors.map((s, idx) => {
        const x = Math.max(0, ((s.start - windowStartSec) / windowLen) * vbW);
        const right = Math.min(((s.end - windowStartSec) / windowLen) * vbW, vbW);
        const w = Math.max(1, right - x);
        return (
          <rect
            key={idx}
            className={`waveform-sector ${idx % 2 === 0 ? "waveform-sector--alt" : ""}`}
            x={x}
            y={vbH / 2 - innerH / 4}
            width={w}
            height={innerH / 2}
            onClick={(e) => handleClick(e, s.start, s.end)}
          >
            <title>{`Sector ${formatTime(s.start)} - ${formatTime(s.end)}`}</title>
          </rect>
        );
      })}
    </>
  );
}
