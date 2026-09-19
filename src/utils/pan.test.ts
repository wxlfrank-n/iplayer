import { describe, expect, it } from "vitest";
import { panTarget } from "./pan";

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