import {clampWindowAnchor} from '../utils/rowWaveform';

export const HS_FOLLOW_FRAC = 0.8;
export const HS_PAN_DECIDE_PX = 8;
export const CURSOR_CLICK_HOLD_MS = 400;
export const VB_W = 500;
export const VB_H = 100;
export const PAD = 4;
export const BARS_TAIL_SEC = 0;
export const WAVE_BUFFER_WINDOWS = 3;
export const WAVE_BUFFER_MARGIN_WINDOWS = 0.4;

export type FollowEpoch = {anchor: number; time: number; align: boolean};
export type PlaybackContext =
  | {type: 'idle'}
  | {type: 'normal'}
  | {type: 'clip'; start: number; end: number};
export type ViewportContext =
  | {type: 'manual'}
  | {
      /** Normal playback: keep the viewport fixed until the playhead reaches 80%, then follow. */
      type: 'follow';
      epoch: FollowEpoch;
    }
  | {type: 'cursor-hold'; epoch: FollowEpoch; holdUntil: number}
  | {
      /** Clip playback: clip-specific initial positioning, then the same 80% follow rule as normal playback. */
      type: 'clip-follow';
      start: number;
      end: number;
      epoch: FollowEpoch;
      autoFollow: boolean;
    };

export function makeFollowEpoch(
  anchor: number,
  windowLength: number,
  time: number,
): FollowEpoch {
  return {
    anchor,
    time,
    // The left and right edges are part of the viewport.
    align: !(time >= anchor && time <= anchor + windowLength),
  };
}

export function resolveFollow(
  epoch: FollowEpoch,
  anchor: number,
  time: number,
  windowLength: number,
  maxStart: number,
): number {
  if (epoch.align) {
    return clampWindowAnchor(time - HS_FOLLOW_FRAC * windowLength, maxStart);
  }
  const threshold = anchor + HS_FOLLOW_FRAC * windowLength;
  if (time < threshold) return anchor;
  return clampWindowAnchor(time - HS_FOLLOW_FRAC * windowLength, maxStart);
}

/**
 * Initial viewport for clip playback.
 *
 * - Fully visible: keep the current viewport and do not auto-follow.
 * - Left-hidden: move to clip.start. If the clip now fits, freeze there;
 *   otherwise arm 80% follow.
 * - Right-hidden, including completely to the right: keep the current
 *   viewport and arm 80% follow.
 */
export function getClipPlaybackViewport(
  start: number,
  end: number,
  currentAnchor: number,
  windowLength: number,
  maxStart: number,
): {anchor: number; autoFollow: boolean} {
  const isFullyVisible = (anchor: number) =>
    start >= anchor && end <= anchor + windowLength;
  if (isFullyVisible(currentAnchor)) {
    return {anchor: currentAnchor, autoFollow: false};
  }
  if (start < currentAnchor) {
    const anchor = clampWindowAnchor(start, maxStart);
    return {anchor, autoFollow: !isFullyVisible(anchor)};
  }
  return {anchor: currentAnchor, autoFollow: true};
}

export function resolveClipFollow(
  context: Extract<ViewportContext, {type: 'clip-follow'}>,
  anchor: number,
  time: number,
  windowLength: number,
  maxStart: number,
): number {
  if (!context.autoFollow) return anchor;
  if (time < context.start) return anchor;

  const clipEndAnchor = clampWindowAnchor(
    Math.max(0, context.end - windowLength),
    maxStart,
  );

  // We have already reached the final viewport for this clip.
  // Never move farther right.
  if (anchor >= clipEndAnchor) {
    return clipEndAnchor;
  }

  const threshold = context.epoch.anchor + HS_FOLLOW_FRAC * windowLength;

  if (time < threshold) return anchor;

  const followTarget = time - HS_FOLLOW_FRAC * windowLength;

  return Math.min(clampWindowAnchor(followTarget, maxStart), clipEndAnchor);
}

export function resolveViewportAnchor(
  context: ViewportContext,
  anchor: number,
  time: number,
  windowLength: number,
  maxStart: number,
  now: number,
): number {
  switch (context.type) {
    case 'manual':
      return anchor;
    case 'follow':
      return resolveFollow(context.epoch, anchor, time, windowLength, maxStart);
    case 'cursor-hold':
      return now < context.holdUntil
        ? anchor
        : resolveFollow(context.epoch, anchor, time, windowLength, maxStart);
    case 'clip-follow':
      return resolveClipFollow(context, anchor, time, windowLength, maxStart);
  }
}
