import { mergeClipsByGap, type Clip } from "./clips";

export type ClipSwipeDirection = "up" | "down";

export interface ClipSwipeResult {
  mergeGap: number;
  activeClip: number;
}

const groupContaining = (groups: Clip[], target: Clip) => {
  const targetChildren = target.children ?? [target];
  return groups.findIndex((group) => {
    const groupChildren = group.children ?? [group];
    return targetChildren.some((child) => groupChildren.includes(child));
  });
};

export function getClipSwipeResult(
  clips: Clip[],
  displayClips: Clip[],
  idx: number,
  direction: ClipSwipeDirection,
  minSilenceLength: number,
): ClipSwipeResult | null {
  const clip = displayClips[idx];
  if (!clip) return null;

  if (direction === "up") {
    const children = clip.children;
    if (!children || children.length < 2) return null;

    const largestChildGap = Math.max(
      ...children.slice(1).map((child, childIdx) =>
        child.start - children[childIdx].end,
      ),
    );
    const mergeGap = Math.max(
      minSilenceLength,
      largestChildGap - 0.000001,
    );
    const nextClips = mergeClipsByGap(clips, mergeGap);
    const activeClip = groupContaining(nextClips, children[0]);
    return activeClip >= 0 ? { mergeGap, activeClip } : null;
  }

  const previous = displayClips[idx - 1];
  const next = displayClips[idx + 1];
  const previousGap = previous ? clip.start - previous.end : Infinity;
  const nextGap = next ? next.start - clip.end : Infinity;
  const mergeGap = Math.min(previousGap, nextGap);
  if (!isFinite(mergeGap)) return null;

  const nextClips = mergeClipsByGap(clips, mergeGap);
  const activeClip = groupContaining(nextClips, clip);
  return activeClip >= 0 ? { mergeGap, activeClip } : null;
}
