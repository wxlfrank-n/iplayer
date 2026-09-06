import { type Sector } from "../utils/vad";

interface SectorProps {
  sectors: Sector[];
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  activeSector: number;
  onActivate: (idx: number) => void;
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Sector({ sectors, windowStartSec, windowLen, innerH, vbW, vbH, onPlayRange, activeSector, onActivate }: SectorProps) {

  const handleClick = (e: React.MouseEvent<SVGRectElement>, idx: number, start: number, end: number) => {
    e.stopPropagation();
    onActivate(idx);
    onPlayRange(start, end, 1);
  };

  return (
    <>
      {sectors.map((s, idx) => {
        if (!(s.end > windowStartSec && s.start < windowStartSec + windowLen)) return null;
        const x = Math.max(0, ((s.start - windowStartSec) / windowLen) * vbW);
        const right = Math.min(((s.end - windowStartSec) / windowLen) * vbW, vbW);
        const w = Math.max(1, right - x);
        return (
          <rect
            key={idx}
            className={`waveform-sector ${idx === activeSector ? "waveform-sector--active" : ""}`}
            x={x}
            y={vbH / 2 - innerH / 4}
            width={w}
            height={innerH / 2}
            onClick={(e) => handleClick(e, idx, s.start, s.end)}
          >
            <title>{`Sector ${idx + 1}: ${formatTime(s.start)} - ${formatTime(s.end)}`}</title>
          </rect>
        );
      })}
    </>
  );
}