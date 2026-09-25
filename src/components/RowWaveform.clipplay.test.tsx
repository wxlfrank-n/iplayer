// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RowWaveform } from "./RowWaveform";
import type { WaveformData } from "../hooks/useWaveform";
import type { Clip as ClipData } from "../utils/clips";

vi.mock("./ClipLabel", () => ({
  ClipLabel: () => null,
}));
vi.mock("./DancingLines", () => ({
  DancingLines: () => null,
}));
vi.mock("./WaveformCursor", () => ({
  WaveformCursor: () => null,
}));
vi.mock("./Waveform", () => ({
  WaveformBars: ({ window }: { window: { windowStartSec: number } }) => (
    <div data-window-start={window.windowStartSec} />
  ),
}));

class FakeResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  observe() {}
  disconnect() {}
}

const waveform: WaveformData = {
  data: new Float32Array(12000),
  sampleRate: 100,
  duration: 120,
};

// Clip 1 (10-20s) and a far clip (90-100s, standing in for "clip 20").
const clips: ClipData[] = [
  { start: 10, end: 20, vStart: 10, vEnd: 20 },
  { start: 90, end: 100, vStart: 90, vEnd: 100 },
];

function renderRow({ initialTime = 10, playing = false } = {}) {
  const props = {
    currentTime: initialTime,
    playing,
  };
  let scrolling = false;
  const setScrolling: React.Dispatch<React.SetStateAction<boolean>> = (v) => {
    scrolling = typeof v === "function" ? v(scrolling) : v;
  };
  const view = render(
    <RowWaveform
      waveform={waveform}
      displayClips={clips}
      currentTime={props.currentTime}
      onSeek={vi.fn()}
      onPlayRange={vi.fn()}
      repetitions={3}
      activeClip={-1}
      onActiveClipChange={vi.fn()}
      getCurrentTime={() => props.currentTime}
      playing={props.playing}
      scrolling={scrolling}
      setScrolling={setScrolling}
      scrollTimeoutRef={{ current: undefined }}
    />,
  );
  const row = view.container.querySelector(".row-waveform") as HTMLDivElement;
  Object.defineProperty(row, "clientWidth", { value: 600 });
  const windowStart = () =>
    Number(row.querySelector("[data-window-start]")?.getAttribute("data-window-start"));

  const rerender = (next: Partial<typeof props>) => {
    Object.assign(props, next);
    view.rerender(
      <RowWaveform
        waveform={waveform}
        displayClips={clips}
        currentTime={props.currentTime}
        onSeek={vi.fn()}
        onPlayRange={vi.fn()}
        repetitions={3}
        activeClip={-1}
        onActiveClipChange={vi.fn()}
        getCurrentTime={() => props.currentTime}
        playing={props.playing}
        scrolling={scrolling}
        setScrolling={setScrolling}
        scrollTimeoutRef={{ current: undefined }}
      />,
    );
  };

  return { view, row, windowStart, rerender };
}

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;
  vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 1);
  vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("RowWaveform clip play follow", () => {
  it("does not yank the window back to the playing clip after the user pans away", () => {
    const { row, windowStart, rerender } = renderRow();

    // Play clip 1 by clicking its rect (10-20s). Window is anchored at 0 here,
    // so the follow arm registers the clip's end as the follow target.
    const firstClip = row.querySelector(".waveform-clip")!;
    fireEvent.click(firstClip);
    rerender({ playing: true });
    act(() => {
      // Pan the window right out to ~40s (the "clip 20" region).
      fireEvent.pointerDown(row, {
        pointerId: 1,
        pointerType: "mouse",
        clientX: 2000,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 0, clientY: 50 });
    });
    expect(windowStart()).toBe(40);

    // The clip's clock wraps when it repeats: currentTime jumps 19 -> 10.5,
    // which must NOT scroll the view back toward the clip.
    rerender({ currentTime: 19 });
    rerender({ currentTime: 10.5 });
    act(() => {
      fireEvent.pointerMove(window, { clientX: 0, clientY: 50 });
    });

    expect(windowStart()).toBe(40);
  });
});