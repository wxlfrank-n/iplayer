import type { Clip } from "./clips";

const MIN_WINDOW_SECS = 4;

/**
 * Desired minimum rendered width of a typical clip.
 *
 * This does not force every clip to be >= 60px. Very short clips are allowed.
 * It only prevents the overall clip layout from becoming too crowded.
 */
const TARGET_CLIP_WIDTH_PX = 30;

export function getBaseWindowSecs(width: number): number {
  if (width >= 1600) return 32;
  if (width >= 1200) return 16;
  if (width >= 800) return 12;
  return 8;
}

export function getWindowSecs(
  width: number,
  clips: Clip[] = [],
): number {
  const baseWindowSecs = getBaseWindowSecs(width);

  if (width <= 0 || clips.length === 0) {
    return baseWindowSecs;
  }

  /*
   * Ignore invalid/zero-length clips.
   */
  const durations = clips
    .map((clip) => clip.vEnd - clip.vStart)
    .filter((duration) => duration > 0)
    .sort((a, b) => a - b);

  if (durations.length === 0) {
    return baseWindowSecs;
  }

  /*
   * Median is deliberately used instead of minimum.
   *
   * One unusually short clip should not zoom the entire waveform in.
   */
  const middle = Math.floor(durations.length / 2);

  const medianDuration =
    durations.length % 2 === 0
      ? (durations[middle - 1] + durations[middle]) / 2
      : durations[middle];

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
  const densityWindowSecs =
    (medianDuration * width) /
    TARGET_CLIP_WIDTH_PX;

  return Math.max(
    MIN_WINDOW_SECS,
    Math.min(
      baseWindowSecs,
      densityWindowSecs,
    ),
  );
}

export function clampWindowAnchor(anchor: number, maxStart: number): number {
  return Math.max(0, Math.min(anchor, maxStart));
}
