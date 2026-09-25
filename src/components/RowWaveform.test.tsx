// @vitest-environment jsdom

import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RowWaveform } from "./RowWaveform";
import type { WaveformData } from "../hooks/useWaveform";
import type { Clip as ClipData } from "../utils/clips";

vi.mock("./Clip", () => ({
  Clip: () => <div className="waveform-clip" />,
}));
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

const clips: ClipData[] = [
  { start: 1, end: 3, vStart: 1, vEnd: 3 },
];

function renderRow({ playing = false, currentTime = 0 } = {}) {
  const props = {
    playing,
    currentTime,
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
      scrolling={false}
      setScrolling={vi.fn()}
      scrollTimeoutRef={{ current: undefined }}
    />,
  );
  const row = view.container.querySelector(".row-waveform") as HTMLDivElement;
  Object.defineProperty(row, "clientWidth", { value: 600 });
  return {
    ...view,
    row,
    clip: view.container.querySelector(".waveform-clip")!,
    rerender: (next: Partial<typeof props>) => {
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
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{ current: undefined }}
        />,
      );
    },
  };
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

describe("RowWaveform clip dragging", () => {
  it("does not scroll horizontally when dragging a clip", () => {
    const { row, clip } = renderRow();

    fireEvent.pointerDown(clip, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 50,
      button: 0,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 0,
        clientY: 50,
      });
    });

    expect(row.querySelector('[data-window-start="0"]')).not.toBeNull();
  });

  it("does not scroll horizontally for a vertical clip swipe", () => {
    const { row, clip } = renderRow();

    fireEvent.pointerDown(clip, {
      pointerId: 2,
      pointerType: "touch",
      clientX: 100,
      clientY: 50,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 2,
        clientX: 100,
        clientY: 100,
      });
    });

    expect(row.querySelector('[data-window-start="0"]')).not.toBeNull();
  });

  it("starts scrolling from the row viewport even when the track is transformed", () => {
    const { row } = renderRow();

    fireEvent.pointerDown(row, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 100,
      clientY: 50,
      button: 0,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 3,
        clientX: 0,
        clientY: 50,
      });
    });

    expect(row.querySelector('[data-window-start="2"]')).not.toBeNull();
  });

  it("keeps a manual drag in control when playback time is outside the window", () => {
    const { row, rerender } = renderRow({ playing: true, currentTime: 60 });

    fireEvent.pointerDown(row, {
      pointerId: 4,
      pointerType: "mouse",
      clientX: 100,
      clientY: 50,
      button: 0,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 4,
        clientX: 0,
        clientY: 50,
      });
      rerender({ currentTime: 61 });
    });

    expect(row.querySelector('[data-window-start="2"]')).not.toBeNull();
  });
});
