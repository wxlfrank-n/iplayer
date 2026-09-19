import { describe, expect, it } from "vitest";
import { mergeClipsByGap, type Clip } from "./clips";
import { getClipSwipeResult } from "./swipe";

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

describe("getClipSwipeResult", () => {
  it("swipes up by opening the largest child gap and activates the first child", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.6);

    const result = getClipSwipeResult(clips, displayClips, 0, "up", 0.1);

    expect(result?.mergeGap).toBeCloseTo(0.499999);
    expect(result?.activeClip).toBe(0);
    expect(mergeClipsByGap(clips, result!.mergeGap)[0].children).toEqual([
      clips[0],
      clips[1],
    ]);
  });

  it("swipes down using the nearest neighboring gap and activates the merged group", () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const result = getClipSwipeResult(clips, displayClips, 1, "down", 0.1);

    expect(result?.mergeGap).toBeCloseTo(0.2);
    expect(result?.activeClip).toBe(0);
    expect(mergeClipsByGap(clips, result!.mergeGap)[0].children).toEqual([
      clips[0],
      clips[1],
    ]);
  });

  it("returns null when swiping up an unmerged clip", () => {
    const clips = [mk(0, 1), mk(2, 3)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(getClipSwipeResult(clips, displayClips, 0, "up", 0.1)).toBeNull();
  });

  it("returns null when swiping down the only displayed clip", () => {
    const clips = [mk(0, 1)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(getClipSwipeResult(clips, displayClips, 0, "down", 0.1)).toBeNull();
  });
});
