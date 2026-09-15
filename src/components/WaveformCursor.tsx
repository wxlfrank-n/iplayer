/**
 * Playhead cursor for a waveform view: a vertical position line plus a floating
 * time label. Shared by the stacked and single-row views; `left` is the cursor
 * position as a fraction (0..1) within the current row/window, so the exact
 * pixel position follows the container.
 *
 * When `getCurrentTime` is provided the time label is refreshed from it in an
 * internal rAF loop, so the displayed time always reflects the live playhead.
 */

import { memo, useEffect, useRef, useState } from "react";
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
  const [pct, setPct] = useState(getPlayedPct() * 100);
  const pctRef = useRef(pct);
  const getPlayedPctRef = useRef(getPlayedPct);
  useEffect(() => {
    getPlayedPctRef.current = getPlayedPct;
  });
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      raf = requestAnimationFrame(frame);
      const left = getPlayedPctRef.current() * 100;
      if (Math.abs(left - pctRef.current) > 0.1) {
        pctRef.current = left;
        setPct(left);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div
        className={`${view}-waveform__cursor`}
        style={{ left: `${pct}%` }}
      >
      <div
        className={`${view}-waveform__time`}
      >
        {formatTime(getCurrentTime())}
      </div>
    </div>
  );
});