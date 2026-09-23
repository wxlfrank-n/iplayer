/**
 * Playhead cursor for a waveform view: a vertical position line plus a floating
 * time label. Shared by the stacked and single-row views; `left` is the cursor
 * position as a fraction (0..1) within the current row/window, so the exact
 * pixel position follows the container.
 *
 * When `getCurrentTime` is provided the time label is refreshed from it in an
 * internal rAF loop, so the displayed time always reflects the live playhead.
 */

import { memo, useEffect, useRef } from "react";
import { formatTime } from "../utils/format";

interface WaveformCursorProps {
  view: "row" | "stacked";
  getPlayedPct: () => number;
  /** Live playhead time source; drives the rAF-updated time label. */
  getCurrentTime: () => number;
}

export const WaveformCursor = memo(function WaveformCursor({
  view,
  getPlayedPct,
  getCurrentTime,
}: WaveformCursorProps) {
  const cursorRef = useRef<HTMLDivElement>(null);
  const prevPctRef = useRef(getPlayedPct() * 100);
  const prevTimeLabelRef = useRef(formatTime(getCurrentTime()));
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      if (!cursorRef.current) return;
      raf = requestAnimationFrame(frame);
      const pct = getPlayedPct() * 100;
      const timeLabel = formatTime(getCurrentTime());
      if (Math.abs(pct - prevPctRef.current) > 0.1) {
        prevPctRef.current = pct;
        cursorRef.current.style.setProperty("left", `${pct}%`);
      }
      if (timeLabel !== prevTimeLabelRef.current) {
        prevTimeLabelRef.current = timeLabel;
        if (cursorRef.current.firstElementChild) {
          cursorRef.current.firstElementChild.textContent = timeLabel;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
      ref={cursorRef}
      className={`${view}-waveform__cursor`}
      style={{ left: `${prevPctRef.current}%` }}
    >
      <div
        className={`${view}-waveform__time`}
      >
        {formatTime(getCurrentTime())}
      </div>
    </div>
  );
});