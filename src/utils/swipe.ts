import { mergeClipsByGap, type Clip } from "./clips";

const groupContaining = (groups: Clip[], target: Clip) => {
  const targetChildren = target.children ?? [target];
  return groups.findIndex((group) => {
    const groupChildren = group.children ?? [group];
    return targetChildren.some((child) => groupChildren.includes(child));
  });
};

/**
 * Whether splitting `clip` (a merged parent) can actually separate its children
 * again. Splitting opens the largest internal gap, but the re-merge threshold
 * is clamped to `minSilenceLength`: if every child gap is at (or below) that
 * minimum, re-merging keeps the whole group, so there is nothing to split.
 */
export function canSplitClip(clip: Clip, minSilenceLength: number): boolean {
  const children = clip.children;
  if (!children || children.length < 2) return false;
  let largestGap = 0;
  for (let i = 1; i < children.length; i++) {
    const gap = children[i].start - children[i - 1].end;
    if (gap > largestGap) largestGap = gap;
  }
  return largestGap - 0.000001 >= minSilenceLength;
}

export interface ClipSplitResult {
  mergeGap: number;
  activeClip: number;
}

/**
 * Swipe up (unpack): raise the merge threshold just below the largest internal
 * child gap so the merged group separates along it. This is a global threshold
 * change (the merge slider moves with it).
 */
export function getClipSplitResult(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
  minSilenceLength: number,
): ClipSplitResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;
  if (!canSplitClip(clip, minSilenceLength)) return null;

  const children = clip.children as Clip[];
  const largestChildGap = Math.max(
    ...children.slice(1).map((child, childIdx) =>
      child.start - children[childIdx].end,
    ),
  );
  const mergeGap = Math.max(minSilenceLength, largestChildGap - 0.000001);
  const nextClips = mergeClipsByGap(clips, mergeGap);
  const activeClip = groupContaining(nextClips, children[0]);
  return activeClip >= 0 ? { mergeGap, activeClip } : null;
}

export interface ClipMergeResult {
  /** The full clip list after merging `idx` with its nearest neighbor. */
  clips: Clip[];
  /** Index of the newly merged group in `clips`. */
  activeClip: number;
}

/**
 * Swipe down (pack): merge the clip at `idx` only with its nearest neighbor
 * (the adjacent group with the smallest inter-group gap), combining their
 * children into a single parent. Unlike the old threshold-based merge, this
 * touches just that one pair and never produces a `mergeGap`.
 */
export function getClipMergeResult(
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

  const children = [...(clip.children ?? [clip]), ...(neighbor.children ?? [neighbor])].sort(
    (a, b) => a.start - b.start,
  );
  const from = Math.min(idx, neighborIdx);
  const to = Math.max(idx, neighborIdx);
  const merged: Clip = {
    start: children[0].start,
    end: children[children.length - 1].end,
    vStart: children[0].vStart,
    vEnd: children[children.length - 1].vEnd,
    children,
  };

  return {
    clips: [...displayClips.slice(0, from), merged, ...displayClips.slice(to + 1)],
    activeClip: from,
  };
}
