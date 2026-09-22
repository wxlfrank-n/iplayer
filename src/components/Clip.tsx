/**
 * Renders detected audio clips (silence-split segments) on the waveform.
 * Each clip is a highlighted rect that user can click to select or play.
 */

import { memo, useRef } from "react";
import { type Clip as ClipData } from "../utils/clips";
import { shouldCaptureClipPointer } from "../utils/gestures";
import { type WaveWindow } from "../types";
import { formatTimePrecise } from "../utils/time";

interface ClipProps {
  clips: ClipData[];
  window: WaveWindow;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  playing: boolean;
  onStopPlayback?: () => void;
  activeClip: number;
  onActivate: (idx: number) => void;
  onSwipe?: (idx: number, direction: "up" | "down") => void;
}

const SWIPE_THRESHOLD_PX = 24;
const TAP_THRESHOLD_PX = 8;

export const Clip = memo(function Clip({
  clips,
  window,
  onPlayRange,
  repetitions,
  playing,
  onStopPlayback,
  activeClip,
  onActivate,
  onSwipe,
}: ClipProps) {
  const { windowStartSec, windowLen, innerH, vbW, vbH } = window;
  const pointerStartRef = useRef<{ x: number; y: number; idx: number } | null>(
    null,
  );
  const suppressClickRef = useRef(false);

  const activateClip = (idx: number, start: number, end: number) => {
    if (playing && idx === activeClip) {
      onStopPlayback?.();
      return;
    }
    onActivate(idx);
    onPlayRange(start, end, repetitions);
  };

  const handleClick = (
    e: React.MouseEvent<SVGRectElement>,
    idx: number,
    start: number,
    end: number,
  ) => {
    e.stopPropagation();
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    activateClip(idx, start, end);
  };

  const handlePointerDown = (
    e: React.PointerEvent<SVGRectElement>,
    idx: number,
  ) => {
    pointerStartRef.current = { x: e.clientX, y: e.clientY, idx };
    if (shouldCaptureClipPointer(e.pointerType)) {
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePointerUp = (
    e: React.PointerEvent<SVGRectElement>,
    idx: number,
    startTime: number,
    endTime: number,
  ) => {
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
      onSwipe?.(start.idx, dy < 0 ? "up" : "down");
    } else if (
      Math.abs(dx) < TAP_THRESHOLD_PX &&
      Math.abs(dy) < TAP_THRESHOLD_PX
    ) {
      e.stopPropagation();
      suppressClickRef.current = true;
      activateClip(idx, startTime, endTime);
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  const visible = (c: ClipData) =>
    c.vEnd > windowStartSec && c.vStart < windowStartSec + windowLen;
  const rect = (c: ClipData) => {
    const x = Math.max(0, ((c.vStart - windowStartSec) / windowLen) * vbW);
    const right = ((c.vEnd - windowStartSec) / windowLen) * vbW;
    return { x, w: Math.max(1, right - x) };
  };

  return (
    <>
      {clips.map((c, idx) => {
        if (!visible(c)) return null;
        const { x, w } = rect(c);
        const isActive = idx === activeClip;
        const y = vbH / 2 - innerH / 4;
        return (
          <rect
            key={idx}
            className={`waveform-clip ${isActive ? "waveform-clip--active" : ""}`}
            x={x}
            y={y}
            width={w}
            height={innerH / 2}
            onClick={(e) => handleClick(e, idx, c.vStart, c.vEnd)}
            onPointerDown={(e) => handlePointerDown(e, idx)}
            onPointerUp={(e) =>
              handlePointerUp(e, idx, c.vStart, c.vEnd)
            }
            onPointerCancel={handlePointerCancel}
          >
            <title>{`${formatTimePrecise(c.vStart)} - ${formatTimePrecise(c.vEnd)}`}</title>
          </rect>
        );
      })}
    </>
  );
});
