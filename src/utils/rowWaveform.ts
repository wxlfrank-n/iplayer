/**
 * Row waveform window math.
 *
 * Two related concerns live here: how much time the row viewport shows
 * (`getWindowSecs`) and where the viewport anchor sits while playing, panning
 * or following a clip (`resolveViewportAnchor` and friends).
 */

import type {Clip} from './clips';
import type {MergeScope} from '../types';

export const HS_FOLLOW_FRAC = 0.8;
export const HS_PAN_DECIDE_PX = 8;
export const CURSOR_CLICK_HOLD_MS = 400;
export const VB_W = 500;
export const VB_H = 100;
export const PAD = 4;
export const BARS_TAIL_SEC = 0;
export const WAVE_BUFFER_WINDOWS = 3;
export const WAVE_BUFFER_MARGIN_WINDOWS = 0.4;

const TARGET_CLIP_WIDTH_PX = 60;

/**
 * Desired minimum rendered width of a typical clip.
 *
 * This does not force every clip to be >= 60px. Very short clips are allowed.
 * It only prevents the overall clip layout from becoming too crowded.
 */

const CLIP_PLAY_MARGIN = 0.1;

export function getBaseWindowSecs(width: number): number {
  if (width >= 1600) return 32;
  if (width >= 1200) return 16;
  return 12;
}

export interface WindowSizingOptions {
  /** Index of the selected clip (only consulted in "clip" scope). */
  activeClip?: number;
  /**
   * Merge scope in effect. In "clip" scope the window sizes off the average
   * duration of the clips around the selected one (a local neighbourhood),
   * because editing works on a local stretch of the track. In "global" scope it
   * sizes off the whole-track average, as before.
   */
  mergeScope?: MergeScope;
}

/**
 * How many clips around the selected clip feed the clip-scope window average.
 * Small enough to track a local stretch of the track, wide enough not to jump
 * when a single clip's length changes.
 */
const WINDOW_NEIGHBOURHOOD_CLIPS = 10;

/**
 * Average clip duration across a run of clips.
 *
 * The total is the bounding span (`last.vEnd - first.vStart`), not the sum of
 * the individual clips, so the silent gaps between them count too — the same
 * way the whole-track average divides the full `waveformDuration` by the clip
 * count.
 */
function averageClipDuration(clips: Clip[]): number {
  if (clips.length === 0) {
    return 0;
  }

  const first = clips[0];
  const last = clips[clips.length - 1];

  return (last.vEnd - first.vStart) / clips.length;
}

/**
 * Average clip duration over up to `WINDOW_NEIGHBOURHOOD_CLIPS` clips centred on
 * `activeClip`, clamped to the ends of the track. Returns 0 when there is no
 * selected clip, so the caller falls back to the whole-track average.
 */
function neighbourhoodAverageDuration(
  clips: Clip[],
  activeClip: number,
): number {
  if (activeClip < 0 || activeClip >= clips.length) {
    return 0;
  }

  const size = Math.min(WINDOW_NEIGHBOURHOOD_CLIPS, clips.length);
  const start = Math.min(
    Math.max(0, activeClip - Math.floor(size / 2)),
    clips.length - size,
  );

  return averageClipDuration(clips.slice(start, start + size));
}

export function getWindowSecs(
  width: number,
  clips: Clip[] = [],
  waveformDuration: number,
  {activeClip = -1, mergeScope = 'clip'}: WindowSizingOptions = {},
): number {
  const baseWindowSecs = getBaseWindowSecs(width);

  if (width <= 0 || clips.length === 0) {
    return baseWindowSecs;
  }

  /*
   * Global scope sizes off the whole track; clip scope follows the local
   * neighbourhood of the selected clip so a stretch of long merged clips (or a
   * run of tiny ones) sizes the window for what is actually being edited.
   */
  const neighbourhoodAvgDuration =
    mergeScope === 'clip' ? neighbourhoodAverageDuration(clips, activeClip) : 0;
  const avgDuration =
    neighbourhoodAvgDuration > 0
      ? neighbourhoodAvgDuration
      : waveformDuration / clips.length;

  /*
   * At windowSecs, a clip of duration D occupies:
   *
   *     D / windowSecs * width
   *
   * We want the median clip to occupy approximately
   * TARGET_CLIP_WIDTH_PX.
   *
   * Therefore:
   *
   *     windowSecs =
   *       D * width / TARGET_CLIP_WIDTH_PX
   */

  const minSecond = 0.1;
  const minWindowSecs = (minSecond * width) / TARGET_CLIP_WIDTH_PX;

  const ratio = (width - TARGET_CLIP_WIDTH_PX) / (baseWindowSecs - minSecond);
  const densityWindowPx =
    (avgDuration - minSecond) * ratio + TARGET_CLIP_WIDTH_PX;
  const densityWindowSecs = (avgDuration * width) / densityWindowPx;

  return Math.max(minWindowSecs, Math.min(baseWindowSecs, densityWindowSecs));
}

export function clampWindowAnchor(anchor: number, maxStart: number): number {
  return Math.max(0, Math.min(anchor, maxStart));
}

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
    const anchor = clampWindowAnchor(start - CLIP_PLAY_MARGIN, maxStart);
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
    Math.max(0, context.end - windowLength + CLIP_PLAY_MARGIN),
    maxStart,
  );

  // We have already reached the final viewport for this clip.
  // Never move farther right.
  if (anchor >= clipEndAnchor) {
    return clipEndAnchor;
  }

  const threshold = context.epoch.anchor + windowLength - CLIP_PLAY_MARGIN;

  if (time < threshold) return anchor;

  const followTarget = time - windowLength + CLIP_PLAY_MARGIN;

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
