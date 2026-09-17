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
}: ClipLabelProps) {
  return (
    <span
      className={`stacked-clip-label ${active ? "stacked-clip-label--active" : ""}`}
      style={{ left: `${left}%` }}
    >
      {index + 1}
      <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>
    </span>
  );
});