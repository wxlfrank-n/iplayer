/**
 * Playhead cursor for a waveform view: a vertical position line plus a floating
 * time label. Shared by the stacked and single-row views; `left` is the cursor
 * position as a fraction (0..1) within the current row/window, so the exact
 * pixel position follows the container.
 *
 * Refs are exposed for the rAF loops in each view to drive the cursor and time
 * label imperatively during playback.
 */

import { memo } from "react";

interface WaveformCursorProps {
  view: "row" | "stacked";
  left: number;
  time: string;
  cursorRef?: React.Ref<HTMLSpanElement | null>;
  timeRef?: React.Ref<HTMLSpanElement | null>;
}

export const WaveformCursor = memo(function WaveformCursor({
  view,
  left,
  time,
  cursorRef,
  timeRef,
}: WaveformCursorProps) {
  const pct = Math.max(0, Math.min(1, left)) * 100;
  const timePct = Math.max(4, Math.min(96, pct));
  return (
    <>
      <span
        className={`${view}-waveform__cursor`}
        ref={cursorRef}
        style={{ left: `${pct}%` }}
      />
      <span
        className={`${view}-waveform__time`}
        ref={timeRef}
        style={{ left: `${timePct}%` }}
      >
        {time}
      </span>
    </>
  );
});