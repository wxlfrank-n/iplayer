/**
 * Clip label rendered above the clip's waveform: an index badge plus its
 * duration. Shared by the stacked and single-row waveform views; `left` is the
 * un-clamped center position of the clip in percent.
 */

import { memo } from "react";

interface ClipLabelProps {
  index: number;
  duration: number;
  left: number;
  active: boolean;
  minLeft?: number;
  maxLeft?: number;
}

export const ClipLabel = memo(function ClipLabel({
  index,
  duration,
  left,
  active,
  minLeft = 0,
  maxLeft = 100,
}: ClipLabelProps) {
  const clamped = Math.max(minLeft, Math.min(maxLeft, left));
  return (
    <span
      className={`stacked-clip-label ${active ? "stacked-clip-label--active" : ""}`}
      style={{ left: `${clamped}%` }}
    >
      {index + 1}
      <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>
    </span>
  );
});