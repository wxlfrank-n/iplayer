/**
 * Renders one detected audio clip as an interactive
 * overlay on the waveform.
 *
 * Gesture ownership:
 *
 * tap
 *   -> activate / play this clip
 *
 * vertical swipe
 *   -> split / merge
 *
 * horizontal drag
 *   -> NOT handled here
 *   -> bubbles to the waveform container
 *   -> RowWaveform scrolls
 *   -> StackedWaveform changes page
 *
 * Important:
 * Clip must NOT capture the pointer on pointer-down.
 * At that moment we do not yet know whether the user
 * intends a vertical clip gesture or horizontal navigation.
 */

import {
  memo,
  useRef,
  type ReactNode,
} from "react";

import type { Clip as ClipData } from "../utils/clips";
import type { WaveWindow } from "../types";

import { formatTimePrecise } from "../utils/time";

export interface ClipProps {
  clip: ClipData;

  window: WaveWindow;

  /** Global clip index. */
  id: number;

  active: boolean;

  label?: ReactNode;

  onPlayRange: (
    start: number,
    end: number,
    repetitions: number,
  ) => void;

  repetitions: number;

  playing: boolean;

  onStopPlayback?: () => void;

  onActivate: (
    idx: number,
  ) => void;

  onSwipe?: (
    idx: number,
    direction: "up" | "down",
  ) => void;
}

const SWIPE_THRESHOLD_PX = 24;
const TAP_THRESHOLD_PX = 8;

interface PointerStart {
  x: number;
  y: number;
}

export const Clip = memo(function Clip({
  clip,
  window,
  id,
  active,
  label,
  onPlayRange,
  repetitions,
  playing,
  onStopPlayback,
  onActivate,
  onSwipe,
}: ClipProps) {
  const {
    windowStartSec,
    windowLen,
    innerH,
    vbH,
  } = window;

  const pointerStartRef =
    useRef<PointerStart | null>(null);

  const suppressClickRef =
    useRef(false);

  /*
   * Clip band occupies the middle half of the
   * waveform vertically.
   */
  const topPct =
    ((vbH / 2 - innerH / 4) /
      vbH) *
    100;

  const heightPct =
    (innerH / 2 / vbH) *
    100;

  const leftPct =
    ((clip.vStart -
      windowStartSec) /
      windowLen) *
    100;

  const widthPct =
    Math.max(
      0.2,
      ((clip.vEnd -
        clip.vStart) /
        windowLen) *
        100,
    );

  const activateClip = () => {
    if (playing && active) {
      onStopPlayback?.();

      return;
    }

    onActivate(id);

    onPlayRange(
      clip.vStart,
      clip.vEnd,
      repetitions,
    );
  };

  /*
   * ---------------------------------------------------------
   * POINTER DOWN
   * ---------------------------------------------------------
   *
   * Deliberately DO NOT call setPointerCapture().
   *
   * Both Clip and its waveform parent need to observe the
   * movement until the gesture direction becomes clear.
   */
  const handlePointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };

    suppressClickRef.current =
      false;
  };

  /*
   * ---------------------------------------------------------
   * POINTER UP
   * ---------------------------------------------------------
   */
  const handlePointerUp = (
    e: React.PointerEvent<HTMLDivElement>,
  ) => {
    const start =
      pointerStartRef.current;

    pointerStartRef.current =
      null;

    if (!start) {
      return;
    }

    const dx =
      e.clientX - start.x;

    const dy =
      e.clientY - start.y;

    const absX =
      Math.abs(dx);

    const absY =
      Math.abs(dy);

    /*
     * Vertical swipe:
     *
     * Clip owns this gesture.
     */
    if (
      absY >=
        SWIPE_THRESHOLD_PX &&
      absY > absX
    ) {
      suppressClickRef.current =
        true;

      e.stopPropagation();

      onSwipe?.(
        id,
        dy < 0
          ? "up"
          : "down",
      );

      return;
    }

    /*
     * Horizontal movement:
     *
     * Do NOT stop propagation.
     *
     * The parent waveform owns horizontal navigation.
     *
     * StackedWaveform:
     *   swipe left  -> next page
     *   swipe right -> previous page
     *
     * RowWaveform:
     *   horizontal pan
     */
    if (
      absX >=
      TAP_THRESHOLD_PX
    ) {
      suppressClickRef.current =
        true;

      return;
    }

    /*
     * Small vertical movement that isn't a swipe
     * shouldn't accidentally become a tap.
     */
    if (
      absY >=
      TAP_THRESHOLD_PX
    ) {
      suppressClickRef.current =
        true;

      return;
    }

    /*
     * Genuine tap.
     */
    suppressClickRef.current =
      true;

    e.stopPropagation();

    activateClip();
  };

  const handlePointerCancel =
    () => {
      pointerStartRef.current =
        null;

      /*
       * A common reason for cancellation is that the
       * parent took ownership of a horizontal drag.
       */
      suppressClickRef.current =
        true;
    };

  /*
   * Browsers may synthesize a click after pointerup.
   *
   * The tap has already been handled above, so suppress
   * that synthetic click.
   */
  const handleClick = (
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    e.stopPropagation();

    if (
      suppressClickRef.current
    ) {
      suppressClickRef.current =
        false;

      return;
    }

    /*
     * Keyboard / accessibility generated click.
     */
    activateClip();
  };

  return (
    <div
      className={
        `waveform-clip ${
          active
            ? "waveform-clip--active"
            : ""
        }`
      }
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        width: `${widthPct}%`,
        height: `${heightPct}%`,
      }}
      title={
        `${formatTimePrecise(
          clip.vStart,
        )} - ${formatTimePrecise(
          clip.vEnd,
        )}`
      }
      onClick={handleClick}
      onPointerDown={
        handlePointerDown
      }
      onPointerUp={
        handlePointerUp
      }
      onPointerCancel={
        handlePointerCancel
      }
    >
      {label}
    </div>
  );
});