import { describe, expect, it } from "vitest";
import { shouldCaptureClipPointer } from "./gestures";

describe("shouldCaptureClipPointer", () => {
  it("leaves touch pointers available for vertical scrolling", () => {
    expect(shouldCaptureClipPointer("touch")).toBe(false);
  });

  it("captures mouse pointers for swipe tracking", () => {
    expect(shouldCaptureClipPointer("mouse")).toBe(true);
  });

  it("captures pen pointers for swipe tracking", () => {
    expect(shouldCaptureClipPointer("pen")).toBe(true);
  });
});