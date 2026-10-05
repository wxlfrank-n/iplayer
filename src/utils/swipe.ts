import {
  mergeClipPair,
  mergeClipsByGap,
  splitClipAtLargestGap,
  type Clip,
} from './clips';
import type {MergeScope} from '../types';

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
 * Swipe up (unpack): split a virtually merged clip at its largest child gap.
 *
 * "clip" scope cuts the selected group in two and leaves every other group
 * exactly as it is. "global" scope instead sets the merge gap just below that
 * same gap and regroups the whole track, so other groups can break up too.
 *
 * Either way the chosen boundary is the largest gap between children, so both
 * scopes agree on where to cut.
 */
export function splitClip(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
  scope: MergeScope = 'clip',
): ClipSplitResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;

  const split = splitClipAtLargestGap(clip);

  if (!split) return null;

  if (scope === 'clip') {
    return {
      clips: [
        ...displayClips.slice(0, idx),
        ...split.pieces,
        ...displayClips.slice(idx + 1),
      ],
      mergeGap: split.gap,
      activeClip: idx,
    };
  }

  // Put the threshold immediately below this gap so that boundary
  // is no longer merged.
  const mergeGap = Math.max(0, split.gap - 0.000001);

  const nextClips = mergeClipsByGap(clips, mergeGap);

  const activeClip = groupContaining(nextClips, clip.children![0]);

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
 * Swipe down (pack): merge the clip at `idx` with its nearest neighbor (the
 * adjacent group with the smallest inter-group gap), combining their children
 * into a single parent. The merge slider follows the silence used for that pair.
 *
 * "clip" scope merges exactly that one pair and leaves every other group as it
 * is. "global" scope instead applies that gap to the raw detection result across
 * the whole track, so other groups can merge too.
 */
export function mergeClips(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
  scope: MergeScope = 'clip',
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

  if (scope === 'clip') {
    const merged = mergeClipPair(
      displayClips[Math.min(idx, neighborIdx)],
      displayClips[Math.max(idx, neighborIdx)],
    );

    return {
      clips: [
        ...displayClips.slice(0, Math.min(idx, neighborIdx)),
        merged,
        ...displayClips.slice(Math.max(idx, neighborIdx) + 1),
      ],
      activeClip: Math.min(idx, neighborIdx),
      mergeGap,
    };
  }

  const result = mergeClipsByGap(clips, mergeGap);

  /*
   * The merged pair is one group starting at `min(clip.start, neighbor.start)`,
   * which is at or before `clip.start`, so scanning back from the end lands on
   * the pair itself.
   */
  const activeClip = groupEnclosing(result, clip);

  return {clips: result, activeClip, mergeGap};
}
