// @vitest-environment jsdom

import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WaveformCursor } from "./WaveformCursor";

describe("WaveformCursor", () => {
  let currentTime = 10;
  let frameCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    currentTime = 10;
    frameCallbacks = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frameCallbacks.push(callback);
      return frameCallbacks.length;
    });
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each(["row", "stacked"] as const)(
    "updates the %s time label when a seek changes time without moving position",
    (viewMode) => {
    const rendered = render(
      <WaveformCursor
        view={viewMode}
        getPlayedPct={() => 0.5}
        getCurrentTime={() => currentTime}
      />,
    );
    const timeLabel = rendered.container.querySelector(`.${viewMode}-waveform__time`);

    expect(timeLabel?.textContent).toBe("0:10");

    currentTime = 20;
    act(() => {
      frameCallbacks[0]?.(0);
    });

    expect(timeLabel?.textContent).toBe("0:20");
    },
  );
});