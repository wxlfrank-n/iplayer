/**
 * Renders a single detected audio clip (silence-split segment) on the
 * waveform: a highlighted rectangle the user can click to select or play.
 * Positioned as a `<div>` (percentage of the overlay layer that exactly
 * matches the canvas bars' window), so it layers over the canvas bars.
 * Rendered by the `Clips` list, which supplies the geometry and callbacks.
 */

import { memo, useRef, type ReactNode } from "react";
import type { Clip as ClipData } from "../utils/clips";
import { shouldCaptureClipPointer } from "../utils/gestures";
import type { WaveWindow } from "../types";
import { formatTimePrecise } from "../utils/time";

export interface ClipProps {
  clip: ClipData;
  window: WaveWindow;
  /** Global clip index reported by activation/swipe callbacks. */
  id: number;
  active: boolean;
  /** Label node (badge, duration, Split/Merge) nested inside the rect. */
  label?: ReactNode;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  playing: boolean;
  onStopPlayback?: () => void;
  onActivate: (idx: number) => void;
  onSwipe?: (idx: number, direction: "up" | "down") => void;
}

const SWIPE_THRESHOLD_PX = 24;
const TAP_THRESHOLD_PX = 8;

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
  const { windowStartSec, windowLen, innerH, vbH } = window;
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  // The clip band is the vertical center half of the waveform strip, expressed
  // as percentages of the overlay layer (which has the same box as the bars).
  const topPct = ((vbH / 2 - innerH / 4) / vbH) * 100;
  const heightPct = (innerH / 2 / vbH) * 100;

  const activateClip = () => {
    if (playing && active) {
      onStopPlayback?.();
      return;
    }
    onActivate(id);
    onPlayRange(clip.vStart, clip.vEnd, repetitions);
  };

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    activateClip();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    if (
      shouldCaptureClipPointer(e.pointerType) &&
      typeof e.currentTarget.setPointerCapture === "function"
    ) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;

    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (
      Math.abs(dy) >= SWIPE_THRESHOLD_PX &&
      Math.abs(dy) > Math.abs(dx)
    ) {
      suppressClickRef.current = true;
      onSwipe?.(id, dy < 0 ? "up" : "down");
    } else if (
      Math.abs(dx) < TAP_THRESHOLD_PX &&
      Math.abs(dy) < TAP_THRESHOLD_PX
    ) {
      e.stopPropagation();
      suppressClickRef.current = true;
      activateClip();
    } else if (Math.abs(dx) >= TAP_THRESHOLD_PX) {
      // A horizontal drag hands the pointer to the row's own pan/scroll; the
      // gesture must not also fire a play on release.
      suppressClickRef.current = true;
    }
    if (
      typeof e.currentTarget.hasPointerCapture === "function" &&
      e.currentTarget.hasPointerCapture(e.pointerId)
    ) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  const left = ((clip.vStart - windowStartSec) / windowLen) * 100;
  const width = Math.max(0.2, ((clip.vEnd - clip.vStart) / windowLen) * 100);

  return (
    <div
      className={`waveform-clip ${active ? "waveform-clip--active" : ""}`}
      style={{
        left: `${left}%`,
        top: `${topPct}%`,
        width: `${width}%`,
        height: `${heightPct}%`,
      }}
      title={`${formatTimePrecise(clip.vStart)} - ${formatTimePrecise(clip.vEnd)}`}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    >
      {label}
    </div>
  );
});