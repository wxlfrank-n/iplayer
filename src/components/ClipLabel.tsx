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
  canSplit: boolean;
  canMerge: boolean;
  minLeft?: number;
  maxLeft?: number;
}

export const ClipLabel = memo(function ClipLabel({
  index,
  duration,
  left,
  active,
  canSplit,
  canMerge,
}: ClipLabelProps) {
  return (
    <span
      className={`stacked-clip-label ${active ? "stacked-clip-label--active" : ""}`}
      style={{ left: `${left}%` }}
    >
      {index + 1}
      <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>
      {active && canSplit && (
        <span
          className="stacked-clip-swipe-arrow stacked-clip-swipe-arrow--up"
          title="Swipe up to split"
          aria-hidden="true"
        />
      )}
      {active && canMerge && (
        <span
          className="stacked-clip-swipe-arrow stacked-clip-swipe-arrow--down"
          title="Swipe down to merge"
          aria-hidden="true"
        />
      )}
    </span>
  );
});