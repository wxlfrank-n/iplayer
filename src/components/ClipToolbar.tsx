/**
 * Advanced clip controls toolbar.
 *
 * Rendered below the waveform when clips exist and advanced controls are
 * expanded (store `showAdvancedControls`). Holds the merge-gap slider and the
 * repeat stepper. Collapses via double-click on its background or a swipe up;
 * the collapsed hit area that re-expands it lives inside progress-container.
 */
import { useRef } from "react";
import type { MouseEvent, PointerEvent } from "react";

import { MergeSlider } from "./MergeSlider";
import { RepsStepper } from "./RepsStepper";

import { useAppDispatch } from "../store/hooks";
import { updateConfig } from "../store/configSlice";

import "./ClipToolbar.css";

/** Vertical distance (px) that counts as a swipe to hide the toolbar. */
export const TOOLBAR_SWIPE_THRESHOLD_PX = 24;

interface PointerStart {
  x: number;
  y: number;
}

interface ClipToolbarProps {
  /** Snapped merge gap (seconds) applied to the clips. */
  mergeGap: number;
  /** Number of clips after merging, shown by the slider. */
  clipCount: number;
  /** Reports a new merge gap whenever the user adjusts it. */
  onMergeGapChange: (gap: number) => void;
  /** Repeat count for clicked clips. */
  repetitions: number;
  /** Reports a new repeat count whenever the user steps it. */
  onRepetitionsChange: (value: number) => void;
  /** Disables the controls (e.g. while playing). */
  disabled?: boolean;
}

export function ClipToolbar({
  mergeGap,
  clipCount,
  onMergeGapChange,
  repetitions,
  onRepetitionsChange,
  disabled = false,
}: ClipToolbarProps) {
  const dispatch = useAppDispatch();

  const pointerStartRef = useRef<PointerStart | null>(null);

  const handleDoubleClick = (e: MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;

    const interactive = target.closest(
      "button, input, select, textarea, a, [role='button'], [role='slider']",
    );

    if (interactive) return;

    dispatch(
      updateConfig({
        showAdvancedControls: false,
      }),
    );
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;

    pointerStartRef.current = null;

    if (!start) {
      return;
    }

    const dy = e.clientY - start.y;
    const absY = Math.abs(dy);
    const absX = Math.abs(e.clientX - start.x);

    /*
     * Swipe up (vertical, upward) hides the toolbar.
     */
    if (absY >= TOOLBAR_SWIPE_THRESHOLD_PX && absY > absX && dy < 0) {
      dispatch(
        updateConfig({
          showAdvancedControls: false,
        }),
      );
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  return (
    <div
      className={`clip-toolbar ${disabled
        ? "clip-toolbar--disabled"
        : ""
        }`}
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      <MergeSlider
        value={mergeGap}
        clipCount={clipCount}
        onChange={onMergeGapChange}
        disabled={disabled}
      />

      <RepsStepper
        value={repetitions}
        onChange={onRepetitionsChange}
        disabled={disabled}
      />
    </div>
  );
}