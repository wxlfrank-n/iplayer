import { type Sector } from "../utils/sectors";
import { formatTimePrecise } from "../utils/time";

interface SectorProps {
  sectors: Sector[];
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  activeSector: number;
  onActivate: (idx: number) => void;
}

export function Sector({ sectors, windowStartSec, windowLen, innerH, vbW, vbH, onPlayRange, repetitions, activeSector, onActivate }: SectorProps) {

  const handleClick = (e: React.MouseEvent<SVGRectElement>, idx: number, start: number, end: number) => {
    e.stopPropagation();
    onActivate(idx);
    onPlayRange(start, end, repetitions);
  };

  const visible = (s: Sector) => s.end > windowStartSec && s.start < windowStartSec + windowLen;
  const rect = (s: Sector) => {
    const x = Math.max(0, ((s.start - windowStartSec) / windowLen) * vbW);
    const right = Math.min(((s.end - windowStartSec) / windowLen) * vbW, vbW);
    return { x, w: Math.max(1, right - x) };
  };

  return (
    <>
      {sectors.map((s, idx) => {
        if (!visible(s)) return null;
        const { x, w } = rect(s);
        const isActive = idx === activeSector;
        const y = vbH / 2 - innerH / 4;
        return (
          <rect
            key={idx}
            className={`waveform-sector ${isActive ? "waveform-sector--active" : ""}`}
            x={x}
            y={y}
            width={w}
            height={innerH / 2}
            onClick={(e) => handleClick(e, idx, s.start, s.end)}
          >
            <title>{`${formatTimePrecise(s.start)} - ${formatTimePrecise(s.end)}`}</title>
          </rect>
        );
      })}
    </>
  );
}