import { clampWindowAnchor } from "../utils/rowWaveform";

export const HS_FOLLOW_FRAC = 0.6;
export const HS_PAN_DECIDE_PX = 8;
export const CURSOR_CLICK_HOLD_MS = 400;
export const VB_W = 500;
export const VB_H = 100;
export const PAD = 4;
export const BARS_TAIL_SEC = 0;
export const WAVE_BUFFER_WINDOWS = 3;
export const WAVE_BUFFER_MARGIN_WINDOWS = 0.4;

export type FollowEpoch = { anchor: number; time: number; align: boolean };
export type PlaybackContext =
  | { type: "idle" }
  | { type: "normal" }
  | { type: "clip"; start: number; end: number };
export type ViewportContext =
  | { type: "manual" }
  | {
      /** Automatically follows playback. During normal forward playback, the viewport scrolls right after the playhead crosses the 60% threshold. */
      type: "follow";
      epoch: FollowEpoch;
    }
  | { type: "cursor-hold"; epoch: FollowEpoch; holdUntil: number }
  | {
      /**
       * Clip playback follow.
       *
       * While the clip plays, the window glides forward at the same rate as
       * the playhead (keeping the playhead at its starting on-screen
       * position) until the clip's end scrolls into view. When the clip is
       * fully visible, or the user took over, it freezes.
       */
      type: "clip-follow";
      start: number;
      end: number;
      autoFollow: boolean;
      /** Viewport anchor at the moment the clip started. */
      anchorStart: number;
      /** Playback time the glide begins from. */
      playbackStart: number;
      /** Clip end that must eventually enter the viewport (null when already visible). */
      followEnd: number | null;
      /** True when the user manually positioned the viewport before arming. */
      preserveView: boolean;
    };

export function makeFollowEpoch(anchor: number, windowLength: number, time: number): FollowEpoch {
  return {
    anchor,
    time,
    align: !(time > anchor && time <= anchor + windowLength),
  };
}

/**
 * Follow target during normal playback.
 *
 * - If the playhead started inside the window, keep the same on-screen
 *   position (glide: anchor + elapsed time).
 * - Otherwise snap the playhead to the 60% slot and glide from there.
 */
export function resolveFollow(epoch: FollowEpoch, time: number, windowLength: number, maxStart: number): number {
  const target = epoch.align
    ? time - HS_FOLLOW_FRAC * windowLength
    : epoch.anchor + (time - epoch.time);
  return clampWindowAnchor(target, maxStart);
}

/**
 * Viewport chosen when arming a *short* clip (fits inside one window).
 * A clip already in view stays where it is; a left-hidden clip jumps to its
 * start; a right-hidden clip keeps the view and keeps following.
 */
export function getClipPlaybackViewport(start: number, end: number, currentAnchor: number, windowLength: number, maxStart: number): { anchor: number; autoFollow: boolean } {
  const isFullyVisible = (anchor: number) => start >= anchor && end <= anchor + windowLength;
  if (isFullyVisible(currentAnchor)) return { anchor: currentAnchor, autoFollow: false };
  if (start < currentAnchor) {
    const anchor = clampWindowAnchor(start, maxStart);
    return { anchor, autoFollow: !isFullyVisible(anchor) };
  }
  return { anchor: currentAnchor, autoFollow: true };
}

export function resolveClipFollow(
  context: Extract<ViewportContext, { type: "clip-follow" }>,
  anchor: number,
  time: number,
  windowLength: number,
  maxStart: number,
): number {
  if (!context.autoFollow) return anchor;
  if (context.followEnd == null) return anchor;
  if (anchor + windowLength >= context.followEnd) return anchor;
  if (time < anchor || time > anchor + windowLength) return anchor;
  return clampWindowAnchor(
    Math.min(
      context.anchorStart + (time - context.playbackStart),
      Math.max(0, context.followEnd - windowLength),
    ),
    maxStart,
  );
}

export function resolveViewportAnchor(context: ViewportContext, anchor: number, time: number, windowLength: number, maxStart: number, now: number): number {
  switch (context.type) {
    case "manual":
      return anchor;
    case "follow":
      return resolveFollow(context.epoch, time, windowLength, maxStart);
    case "cursor-hold":
      return now < context.holdUntil ? anchor : resolveFollow(context.epoch, time, windowLength, maxStart);
    case "clip-follow":
      return resolveClipFollow(context, anchor, time, windowLength, maxStart);
  }
}