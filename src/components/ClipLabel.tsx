/**
 * Clip label rendered inside the clip's <div>, hanging just below the clip
 * band: an index badge plus its duration.
 *
 * On the active clip, contextual action buttons are shown:
 *
 *   ✂  Split
 *   🔗 Merge
 *
 * The buttons also communicate the equivalent swipe gestures:
 * swipe up = split, swipe down = merge.
 */

import { memo } from "react";
import { useT } from "../i18n";
import "./ClipLabel.css";

interface ClipLabelProps {
  index: number;
  duration: number;
  active: boolean;
  canSplit: boolean;
  canMerge: boolean;
  onSplit?: () => void;
  onMerge?: () => void;
}

export const ClipLabel = memo(function ClipLabel({
  index,
  duration,
  active,
  canSplit,
  canMerge,
  onSplit,
  onMerge,
}: ClipLabelProps) {
  const t = useT();
  return (
    <span
      className={`stacked-clip-label ${
        active ? "stacked-clip-label--active" : ""
      }`}
    >
      {index + 1}

      <span className="stacked-clip-dur">
        {duration.toFixed(1)}s
      </span>

      {active && canSplit && onSplit && (
        <button
          type="button"
          className="stacked-clip-action stacked-clip-action--split"
          title={t("clipLabel.split")}
          aria-label={t("clipLabel.split")}
          onClick={(e) => {
            e.stopPropagation();
            onSplit();
          }}
        >
          <span aria-hidden="true">✂</span>
        </button>
      )}

      {active && canMerge && onMerge && (
        <button
          type="button"
          className="stacked-clip-action stacked-clip-action--merge"
          title={t("clipLabel.merge")}
          aria-label={t("clipLabel.merge")}
          onClick={(e) => {
            e.stopPropagation();
            onMerge();
          }}
        >
          <span aria-hidden="true">{"\u22C8"}</span>
        </button>
      )}
    </span>
  );
});
