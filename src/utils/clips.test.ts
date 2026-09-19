import { describe, expect, it } from "vitest";
import { mergeClipsByGap, type Clip } from "./clips";

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

const bounds = (clips: Clip[]) => clips.map((c) => [c.start, c.end]);

describe("mergeClipsByGap", () => {
  it("returns [] for an empty input", () => {
    expect(mergeClipsByGap([], 0.5)).toEqual([]);
  });

  it("returns a single clip unchanged with no children", () => {
    const clip = mk(0, 1);
    expect(mergeClipsByGap([clip], 0.5)).toEqual([clip]);
    expect(mergeClipsByGap([clip], 0.5)[0].children).toBeUndefined();
  });

  it("merges consecutive clips whose gap is within minGap into a parent", () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const [parent] = mergeClipsByGap([a, b], 0.5);
    expect(parent).toEqual({
      start: 0,
      end: 2,
      vStart: 0,
      vEnd: 2,
      children: [a, b],
    });
  });

  it("merges when the gap exactly equals minGap", () => {
    const a = mk(0, 1);
    const b = mk(1.5, 2);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([
      { start: 0, end: 2, vStart: 0, vEnd: 2, children: [a, b] },
    ]);
  });

  it("keeps clips separate when the gap exceeds minGap", () => {
    const a = mk(0, 1);
    const b = mk(10, 11);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([a, b]);
  });

  it("preserves the original clip references for unmerged clips", () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(10, 11);
    const result = mergeClipsByGap([a, b, c], 0.5);
    expect(result[0].children).toEqual([a, b]);
    expect(result[1]).toBe(c);
  });

  it("produces a single parent spanning everything when all gaps merge", () => {
    const clips = [mk(0, 1), mk(1.1, 2), mk(2.1, 3), mk(3.2, 4)];
    expect(bounds(mergeClipsByGap(clips, 1))).toEqual([[0, 4]]);
  });

  it("groups several merged runs separated by large gaps", () => {
    const a = mk(0, 1);
    const b = mk(1.1, 2);
    const c = mk(2.1, 3);
    const d = mk(4, 5);
    const e = mk(5.1, 6);
    const result = mergeClipsByGap([a, b, c, d, e], 0.15);
    expect(bounds(result)).toEqual([
      [0, 3],
      [4, 6],
    ]);
    expect(result[0].children).toEqual([a, b, c]);
    expect(result[1].children).toEqual([d, e]);
  });

  it("keeps vStart/vEnd of the parent as the outer span of its children", () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(2.4, 3.5);
    const [parent] = mergeClipsByGap([a, b, c], 0.5);
    expect(parent.vStart).toBe(0);
    expect(parent.vEnd).toBe(3.5);
  });
});