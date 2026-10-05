import {mergeClipsByGap, type Clip} from './clips';

/**
 * Index of the group that begins at (or after) the split clip's first child.
 *
 * `mergeClipsByGap` keeps the list sorted by start, and the boundary gap is no
 * longer merged, so the piece that replaces the split group starts exactly at
 * `target.start`. Comparing in this direction -- rather than "starts before"
 * -- matters: lowering the merge gap also breaks up earlier groups, which
 * shifts the split group to a higher index.
 */
const groupContaining = (groups: Clip[], target: Clip) =>
  groups.findIndex(group => group.start >= target.start);

/**
 * Index of the group that encloses `target`.
 *
 * Merging absorbs an adjacent group, so the new group starts *before* `target`
 * and ends after it. That makes the "starts at or after" search above land on
 * the following group, so merging scans from the other end: the last group
 * starting at or before `target.start`.
 */
const groupEnclosing = (groups: Clip[], target: Clip) => {
  for (let i = groups.length - 1; i >= 0; i--) {
    if (groups[i].start <= target.start) return i;
  }
  return -1;
};

export interface ClipSplitResult {
  mergeGap: number;
  activeClip: number;
  clips?: Clip[];
}

/**
 * Swipe up (unpack): set the merge slider just below the largest gap between
 * the group's children so the group separates at that boundary.
 */
export function splitClip(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
): ClipSplitResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;

  // Prefer explicit children. If the displayed clip has no children,
  // recover the original clips contained by its range.
  const children = clip.children ?? [];

  if (children.length < 2) return null;

  let largestChildGap = -Infinity;

  for (let i = 1; i < children.length; i++) {
    const gap = children[i].start - children[i - 1].end;
    largestChildGap = Math.max(largestChildGap, gap);
  }

  if (!Number.isFinite(largestChildGap)) return null;

  // Put the threshold immediately below this gap so that boundary
  // is no longer merged.
  const mergeGap = Math.max(0, largestChildGap - 0.000001);

  const nextClips = mergeClipsByGap(clips, mergeGap);
  const activeClip = groupContaining(nextClips, children[0]);

  return nextClips.length > 0
    ? {
        clips: nextClips,
        mergeGap,
        activeClip: activeClip === -1 ? 0 : activeClip,
      }
    : null;
}

export interface ClipMergeResult {
  /** The full clip list after merging `idx` with its nearest neighbor. */
  clips: Clip[];
  /** Index of the newly merged group in `clips`. */
  activeClip: number;
  /** The silence separating the selected clip from its nearest neighbor. */
  mergeGap: number;
}

/**
 * Swipe down (pack): merge the clip at `idx` only with its nearest neighbor
 * (the adjacent group with the smallest inter-group gap), combining their
 * children into a single parent. The merge slider follows the silence used
 * for that pair.
 */
export function mergeClips(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
): ClipMergeResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;

  const previous = displayClips[idx - 1];
  const next = displayClips[idx + 1];
  const previousGap = previous ? clip.start - previous.end : Infinity;
  const nextGap = next ? next.start - clip.end : Infinity;
  const neighborIdx = previousGap <= nextGap ? idx - 1 : idx + 1;
  const neighbor = displayClips[neighborIdx];
  if (!neighbor) return null;
  const mergeGap = Math.min(previousGap, nextGap);
  const result = mergeClipsByGap(clips, mergeGap);
  const activeClip = groupEnclosing(result, clip);
  return {clips: result, activeClip, mergeGap};
}
