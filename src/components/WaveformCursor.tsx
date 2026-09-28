import { memo, useEffect, useRef, useState } from "react";
import { formatTime } from "../utils/format";

interface WaveformCursorProps {
  view: "row" | "stacked";
  getPlayedPct: () => number;
  getCurrentTime: () => number;
  cursorRef?: React.RefObject<HTMLDivElement | null>;
}

export const WaveformCursor = memo(function WaveformCursor({
  view,
  getPlayedPct,
  getCurrentTime,
  cursorRef: forwardCursorRef,
}: WaveformCursorProps) {
  const elRef = useRef<HTMLDivElement>(null);
  const externallyPositioned = forwardCursorRef != null;
  const [initialPct] = useState(() => getPlayedPct() * 100);
  const prevPctRef = useRef(initialPct);
  const prevTimeLabelRef = useRef(formatTime(getCurrentTime()));

  useEffect(() => {
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);

      const el = elRef.current;
      if (!el) return;

      // Stacked view owns its own percentage positioning.
      // Row view is positioned exclusively by useRowWaveformScroll.
      if (!externallyPositioned) {
        const pct = getPlayedPct() * 100;

        if (Math.abs(pct - prevPctRef.current) > 1e-6) {
          prevPctRef.current = pct;

          const parentWidth = el.parentElement?.clientWidth ?? 0;
          const maxPct =
            parentWidth > 2 ? ((parentWidth - 2) / parentWidth) * 100 : 100;

          el.style.left = `${Math.max(0, Math.min(pct, maxPct))}%`;
        }

        const label = el.firstElementChild as HTMLElement | null;
        if (label) {
          if (pct <= 3) {
            label.style.left = "6px";
            label.style.right = "auto";
            label.style.transform = "translateX(0)";
          } else if (pct >= 97) {
            label.style.right = "6px";
            label.style.left = "auto";
            label.style.transform = "translateX(0)";
          } else {
            label.style.left = "auto";
            label.style.right = "auto";
            label.style.transform = "translateX(-50%)";
          }
        }
      }

      const timeLabel = formatTime(getCurrentTime());
      if (timeLabel !== prevTimeLabelRef.current) {
        prevTimeLabelRef.current = timeLabel;
        const label = el.firstElementChild;
        if (label) label.textContent = timeLabel;
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [externallyPositioned, getCurrentTime, getPlayedPct]);

  const setRef = (el: HTMLDivElement | null) => {
    elRef.current = el;
    if (forwardCursorRef) forwardCursorRef.current = el;
  };

  return (
    <div
      ref={setRef}
      className={`${view}-waveform__cursor`}
      style={externallyPositioned ? undefined : { left: `${initialPct}%` }}
    >
      <div className={`${view}-waveform__time`}>
        {formatTime(getCurrentTime())}
      </div>
    </div>
  );
});
