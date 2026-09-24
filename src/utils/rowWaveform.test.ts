import { describe, expect, it } from "vitest";
import { clampWindowAnchor, getWindowSecs } from "./rowWaveform";

describe("getWindowSecs", () => {
  const cases: Array<[number, number]> = [
    [400, 8],
    [800, 12],
    [1200, 16],
    [1600, 32],
  ];

  it.each(cases)("returns %s seconds for width %s", (width, expected) => {
    expect(getWindowSecs(width)).toBe(expected);
  });
});

describe("clampWindowAnchor", () => {
  const cases: Array<[number, number, number]> = [
    [0, 40, 0],
    [10, 40, 10],
    [45, 40, 40],
    [-5, 40, 0],
  ];

  it.each(cases)("clamps anchor %s using maxStart %s to %s", (anchor, maxStart, expected) => {
    expect(clampWindowAnchor(anchor, maxStart)).toBe(expected);
  });
});
