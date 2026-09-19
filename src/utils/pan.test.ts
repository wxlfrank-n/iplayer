import { describe, expect, it } from "vitest";
import type { Clip } from "./clips";
import { endPan, nearestClipIndex, panTarget } from "./pan";

const clip = (vStart: number): Clip => ({
  start: vStart,
  end: vStart + 1,
  vStart,
  vEnd: vStart + 1,
});

describe("panTarget", () => {
  it("moves the anchor forward when dragging left", () => {
    expect(panTarget(0, -100, 12, 600, 88)).toBe(2);
  });

  it("moves the anchor backward when dragging right", () => {
    expect(panTarget(10, 100, 12, 600, 88)).toBe(8);
  });

  it("clamps to the window start (0) when dragging right past it", () => {
    expect(panTarget(10, 500, 12, 600, 88)).toBe(0);
  });

  it("clamps to maxStart when dragging left past the end", () => {
    expect(panTarget(80, -2000, 12, 600, 88)).toBe(88);
  });

  it("keeps the anchor unchanged for zero movement", () => {
    expect(panTarget(5, 0, 12, 600, 88)).toBe(5);
  });

  it("uses a 1px fallback when clientWidth is unavailable", () => {
    expect(panTarget(0, -10, 12, 0, 1000)).toBe(120);
  });
});

describe("nearestClipIndex", () => {
  it("returns -1 for no clips", () => {
    expect(nearestClipIndex([], 5)).toBe(-1);
  });

  it("picks the clip whose start is nearest the anchor", () => {
    expect(nearestClipIndex([clip(0), clip(10), clip(50)], 12)).toBe(1);
    expect(nearestClipIndex([clip(0), clip(10), clip(50)], 7)).toBe(1);
    expect(nearestClipIndex([clip(0), clip(10), clip(50)], 3)).toBe(0);
  });

  it("ties resolve in favor of the earlier clip", () => {
    expect(nearestClipIndex([clip(0), clip(10)], 5)).toBe(0);
  });
});

describe("endPan", () => {
  it("preserves the panned anchor on release (no snap-back)", () => {
    const { anchor } = endPan(15, [clip(0), clip(10)]);
    expect(anchor).toBe(15);
  });

  it("returns the clip index nearest the released anchor", () => {
    const { index } = endPan(15, [clip(0), clip(10)]);
    expect(index).toBe(1);
  });

  it("returns -1 when there are no clips and keeps the anchor", () => {
    expect(endPan(3, [])).toEqual({ anchor: 3, index: -1 });
  });
});