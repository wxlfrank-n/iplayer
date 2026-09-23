import { describe, expect, it } from "vitest";
import { mergeClipsByGap, type Clip } from "./clips";
import {
  canSplitClip,
  getClipMergeResult,
  getClipSplitResult,
} from "./swipe";

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

describe("canSplitClip", () => {
  it("is false for clips without children", () => {
    expect(canSplitClip(mk(0, 1), 0.1)).toBe(false);
  });

  it("is false when every child gap is at or below the minimum silence", () => {
    const clip: Clip = {
      start: 0,
      end: 3,
      vStart: 0,
      vEnd: 3,
      children: [mk(0, 0.5), mk(0.8, 1.3), mk(1.6, 2.1), mk(2.4, 3)],
    };
    // largest gap = 0.3, minSilenceLength = 0.5 -> cannot open any gap
    expect(canSplitClip(clip, 0.5)).toBe(false);
    expect(getClipSplitResult([clip], [clip], 0, 0.5)).toBeNull();
  });

  it("is true when the largest child gap exceeds the minimum silence", () => {
    const clip: Clip = {
      start: 0,
      end: 3,
      vStart: 0,
      vEnd: 3,
      children: [mk(0, 0.5), mk(0.8, 1.3), mk(2, 2.5)],
    };
    // largest gap (0.7) > 0.1 -> the clip can be split there
    expect(canSplitClip(clip, 0.1)).toBe(true);
    expect(getClipSplitResult([clip], [clip], 0, 0.1)).not.toBeNull();
  });
});

describe("getClipSplitResult", () => {
  it("sets the merge gap to the smallest child gap", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.6);

    const result = getClipSplitResult(clips, displayClips, 0, 0.1);

    expect(result?.mergeGap).toBeCloseTo(0.2);
    expect(result?.activeClip).toBe(0);
    expect(mergeClipsByGap(clips, result!.mergeGap)[0].children).toEqual([
      clips[0],
      clips[1],
    ]);
  });

  it("returns null when splitting an unmerged clip", () => {
    const clips = [mk(0, 1), mk(2, 3)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(getClipSplitResult(clips, displayClips, 0, 0.1)).toBeNull();
  });
});

describe("getClipMergeResult", () => {
  it("merges only the clip and tracks its nearest silence", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1); // all four separate

    const result = getClipMergeResult(displayClips, 1);

    // nearest gap for idx 1 is the previous (0.2 vs 0.5)
    expect(result?.clips).toHaveLength(3);
    expect(result?.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result?.clips[2]).toEqual(clips[3]);
    expect(result?.activeClip).toBe(0);
    expect(result?.mergeGap).toBeCloseTo(0.2);
    expect(result?.clips[0].start).toBe(0);
    expect(result?.clips[0].end).toBe(2);
  });

  it("merges toward the nearest neighbor when the next gap is smaller", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const result = getClipMergeResult(displayClips, 0);

    expect(result?.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result?.activeClip).toBe(0);
    expect(result?.mergeGap).toBeCloseTo(0.2);
  });

  it("merges an already-merged group with its nearest group", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const first = getClipMergeResult(displayClips, 1)!;
    const second = getClipMergeResult(first.clips, first.activeClip)!;

    expect(second.clips).toHaveLength(2);
    expect(second.clips[0].children).toEqual([
      clips[0],
      clips[1],
      clips[2],
    ]);
    expect(second.activeClip).toBe(0);
    expect(second.mergeGap).toBeCloseTo(0.5);
  });

  it("returns null when merging the only displayed clip", () => {
    const clips = [mk(0, 1)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(getClipMergeResult(displayClips, 0)).toBeNull();
  });
});
