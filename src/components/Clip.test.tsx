// @vitest-environment jsdom

import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { Clip } from "./Clip";
import type { WaveWindow } from "../types";
import type { Clip as ClipData } from "../utils/clips";

const windowConfig: WaveWindow = {
  windowStartSec: 0,
  windowLen: 10,
  innerH: 192,
  vbW: 1000,
  vbH: 200,
};

const clip: ClipData = {
  start: 1,
  end: 3,
  vStart: 1,
  vEnd: 3,
};

const renderClip = (overrides: Partial<React.ComponentProps<typeof Clip>> = {}) => {
  const props: React.ComponentProps<typeof Clip> = {
    clips: [clip],
    window: windowConfig,
    onPlayRange: vi.fn(),
    repetitions: 3,
    playing: false,
    onStopPlayback: vi.fn(),
    activeClip: -1,
    onActivate: vi.fn(),
    onSwipe: vi.fn(),
    ...overrides,
  };
  const view = render(
    <svg>
      <Clip {...props} />
    </svg>,
  );
  return { ...view, rect: view.container.querySelector("rect")!, props };
};

beforeAll(() => {
  SVGElement.prototype.setPointerCapture = vi.fn();
  SVGElement.prototype.releasePointerCapture = vi.fn();
  SVGElement.prototype.hasPointerCapture = vi.fn(() => false);
});

describe("Clip UI gestures", () => {
  it("plays on a tap without requiring a second click", () => {
    const { rect, props } = renderClip();

    fireEvent.pointerDown(rect, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 1,
      pointerType: "touch",
      clientX: 102,
      clientY: 102,
    });

    expect(props.onActivate).toHaveBeenCalledWith(0);
    expect(props.onPlayRange).toHaveBeenCalledWith(1, 3, 3);
  });

  it("reports a swipe up without playing the clip", () => {
    const onSwipe = vi.fn();
    const onPlayRange = vi.fn();
    const { rect } = renderClip({ onSwipe, onPlayRange });

    fireEvent.pointerDown(rect, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 100,
      clientY: 60,
    });

    expect(onSwipe).toHaveBeenCalledWith(0, "up");
    expect(onPlayRange).not.toHaveBeenCalled();
  });

  it("reports a swipe down without playing the clip", () => {
    const onSwipe = vi.fn();
    const onPlayRange = vi.fn();
    const { rect } = renderClip({ onSwipe, onPlayRange });

    fireEvent.pointerDown(rect, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerUp(rect, {
      pointerId: 3,
      pointerType: "touch",
      clientX: 100,
      clientY: 140,
    });

    expect(onSwipe).toHaveBeenCalledWith(0, "down");
    expect(onPlayRange).not.toHaveBeenCalled();
  });

  it("stops playback when a playing clip is clicked", () => {
    const onStopPlayback = vi.fn();
    const onPlayRange = vi.fn();
    const { rect } = renderClip({
      playing: true,
      onStopPlayback,
      onPlayRange,
    });

    fireEvent.click(rect);

    expect(onStopPlayback).toHaveBeenCalledTimes(1);
    expect(onPlayRange).not.toHaveBeenCalled();
  });
});
