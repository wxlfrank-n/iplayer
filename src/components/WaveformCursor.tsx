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
  /** When provided, the element ref is forwarded AND `left` position is driven
   *  externally (e.g. in lock-step with the row strip's transform); the
   *  component then only maintains the time label. */
  cursorRef?: React.RefObject<HTMLDivElement | null>;
}

export const WaveformCursor = memo(function WaveformCursor({
  view,
  getPlayedPct,
  getCurrentTime,
  cursorRef: forwardCursorRef,
}: WaveformCursorProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const [initialPct] = useState(() => getPlayedPct() * 100);
  const prevPctRef = useRef(initialPct);
  const prevTimeLabelRef = useRef(formatTime(getCurrentTime()));
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      if (!elRef.current) return;
      raf = requestAnimationFrame(frame);
      const timeLabel = formatTime(getCurrentTime());
      if (!forwardCursorRef) {
        const pct = getPlayedPct() * 100;
        if (Math.abs(pct - prevPctRef.current) > 1e-6) {
          prevPctRef.current = pct;
          const parent = elRef.current.parentElement;
          const pw = parent ? parent.clientWidth : 0;
          const maxLeft = pw > 2 ? ((pw - 2) / pw) * 100 : 100;
          elRef.current.style.setProperty(
            "left",
            `${Math.min(pct, maxLeft)}%`,
          );
        }
        // Pin the floating label inside when the cursor sits at a row edge, so
        // a playhead at the track's start/end is never half-clipped.
        const label = elRef.current.firstElementChild as HTMLElement | null;
        if (label) {
          if (pct <= 3) {
            label.style.setProperty("left", "6px");
            label.style.setProperty("right", "auto");
            label.style.setProperty("transform", "translateX(0)");
          } else if (pct >= 97) {
            label.style.setProperty("right", "6px");
            label.style.setProperty("left", "auto");
            label.style.setProperty("transform", "translateX(0)");
          } else {
            label.style.setProperty("left", "auto");
            label.style.setProperty("right", "auto");
            label.style.setProperty("transform", "translateX(-50%)");
          }
        }
      }
      if (timeLabel !== prevTimeLabelRef.current) {
        prevTimeLabelRef.current = timeLabel;
        if (elRef.current.firstElementChild) {
          elRef.current.firstElementChild.textContent = timeLabel;
        }
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [forwardCursorRef, getCurrentTime, getPlayedPct]);

  const setRef = (el: HTMLDivElement | null) => {
    elRef.current = el;
    if (forwardCursorRef) forwardCursorRef.current = el;
  };

  return (
    <div
      ref={setRef}
      className={`${view}-waveform__cursor`}
      style={forwardCursorRef ? undefined : { left: `${initialPct}%` }}
    >
      <div
        className={`${view}-waveform__time`}
      >
        {formatTime(getCurrentTime())}
      </div>
    </div>
  );
});