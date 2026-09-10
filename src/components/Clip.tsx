import { type Clip } from "../utils/clips";
import { formatTimePrecise } from "../utils/time";

interface ClipProps {
  clips: Clip[];
  windowStartSec: number;
  windowLen: number;
  innerH: number;
  vbW: number;
  vbH: number;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  activeClip: number;
  onActivate: (idx: number) => void;
}

export function Clip({ clips, windowStartSec, windowLen, innerH, vbW, vbH, onPlayRange, repetitions, activeClip, onActivate }: ClipProps) {

  const handleClick = (e: React.MouseEvent<SVGRectElement>, idx: number, start: number, end: number) => {
    e.stopPropagation();
    onActivate(idx);
    onPlayRange(start, end, repetitions);
  };

  const visible = (c: Clip) => c.end > windowStartSec && c.start < windowStartSec + windowLen;
  const rect = (c: Clip) => {
    const x = Math.max(0, ((c.start - windowStartSec) / windowLen) * vbW);
    const right = Math.min(((c.end - windowStartSec) / windowLen) * vbW, vbW);
    return { x, w: Math.max(1, right - x) };
  };

  return (
    <>
      {clips.map((c, idx) => {
        if (!visible(c)) return null;
        const { x, w } = rect(c);
        const isActive = idx === activeClip;
        const y = vbH / 2 - innerH / 4;
        return (
          <rect
            key={idx}
            className={`waveform-clip ${isActive ? "waveform-clip--active" : ""}`}
            x={x}
            y={y}
            width={w}
            height={innerH / 2}
            onClick={(e) => handleClick(e, idx, c.start, c.end)}
          >
            <title>{`${formatTimePrecise(c.start)} - ${formatTimePrecise(c.end)}`}</title>
          </rect>
        );
      })}
    </>
  );
}