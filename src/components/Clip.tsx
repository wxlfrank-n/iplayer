/**
 * Renders detected audio clips (silence-split segments) on the waveform.
 * Each clip is a highlighted rect that user can click to select or play.
 */

import { memo } from "react";
import { type Clip as ClipData } from "../utils/clips";
import { type WaveWindow } from "../types";
import { formatTimePrecise } from "../utils/time";

interface ClipProps {
  clips: ClipData[];
  window: WaveWindow;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  activeClip: number;
  onActivate: (idx: number) => void;
}

export const Clip = memo(function Clip({
  clips,
  window,
  onPlayRange,
  repetitions,
  activeClip,
  onActivate,
}: ClipProps) {
  const { windowStartSec, windowLen, innerH, vbW, vbH } = window;

  const handleClick = (
    e: React.MouseEvent<SVGRectElement>,
    idx: number,
    start: number,
    end: number,
  ) => {
    e.stopPropagation();
    onActivate(idx);
    onPlayRange(start, end, repetitions);
  };

  const visible = (c: ClipData) =>
    c.end > windowStartSec && c.start < windowStartSec + windowLen;
  const rect = (c: ClipData) => {
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
});
