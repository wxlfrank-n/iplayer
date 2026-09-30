import { mergeClipsByGap, type Clip } from "./clips";

const groupContaining = (groups: Clip[], target: Clip) => {
  const targetChildren = target.children ?? [target];
  return groups.findIndex((group) => {
    const groupChildren = group.children ?? [group];
    return targetChildren.some((child) => groupChildren.includes(child));
  });
};

export interface ClipSplitResult {
  mergeGap: number;
  activeClip: number;
}

/**
 * Swipe up (unpack): set the merge slider just below the largest gap between
 * the group's children so the group separates at that boundary.
 */
export function getClipSplitResult(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
): ClipSplitResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;

  // Prefer explicit children. If the displayed clip has no children,
  // recover the original clips contained by its range.
  const children = clip.children?.length
    ? clip.children
    : clips.filter((child) => child.start >= clip.start && child.end <= clip.end);

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

  return nextClips.length > 0 ? { mergeGap, activeClip: activeClip == -1 ? 0 : activeClip } : null;
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
  const mergeGap = Math.min(previousGap, nextGap);

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
    mergeGap,
  };
}
