/**
 * Clip label rendered above the clip's waveform: an index badge plus its
 * duration. Shared by the stacked and single-row waveform views; `left` is the
 * un-clamped center position of the clip in percent.
 *
 * On the active clip the badge shows contextual Split/Merge icon buttons that
 * sit in the direction of the equivalent swipe gesture (swipe up =
 * split/unpack, swipe down = merge/pack). The buttons are clickable so the
 * actions stay discoverable without the gesture.
 */

import { memo } from "react";

interface ClipLabelProps {
  index: number;
  duration: number;
  left: number;
  active: boolean;
  canSplit: boolean;
  canMerge: boolean;
  onSplit?: () => void;
  onMerge?: () => void;
  minLeft?: number;
  maxLeft?: number;
}

const SplitIcon = () => (
  <svg
    viewBox="0 0 12 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 11 L6 5 L10 11" />
  </svg>
);

const MergeIcon = () => (
  <svg
    viewBox="0 0 12 16"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 5 L6 11 L10 5" />
  </svg>
);

export const ClipLabel = memo(function ClipLabel({
  index,
  duration,
  left,
  active,
  canSplit,
  canMerge,
  onSplit,
  onMerge,
}: ClipLabelProps) {
  return (
    <span
      className={`stacked-clip-label ${active ? "stacked-clip-label--active" : ""}`}
      style={{ left: `${left}%` }}
    >
      {index + 1}
      <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>
      {active && canSplit && onSplit && (
        <button
          type="button"
          className="stacked-clip-action stacked-clip-action--split"
          title="Split into separate clips"
          aria-label="Split into separate clips"
          onClick={(e) => {
            e.stopPropagation();
            onSplit();
          }}
        >
          <SplitIcon />
        </button>
      )}
      {active && canMerge && onMerge && (
        <button
          type="button"
          className="stacked-clip-action stacked-clip-action--merge"
          title="Merge with the adjacent clip"
          aria-label="Merge with the adjacent clip"
          onClick={(e) => {
            e.stopPropagation();
            onMerge();
          }}
        >
          <MergeIcon />
        </button>
      )}
    </span>
  );
});