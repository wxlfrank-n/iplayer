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

function renderRow({ initialTime = 10, playing = false, clips: useClips = clips } = {}) {
  const props = {
    currentTime: initialTime,
    playing,
  };
  const onSeek = vi.fn();
  let scrolling = false;
  const setScrolling: React.Dispatch<React.SetStateAction<boolean>> = (v) => {
    scrolling = typeof v === "function" ? v(scrolling) : v;
  };
  const view = render(
    <RowWaveform
      waveform={waveform}
      displayClips={useClips}
      currentTime={props.currentTime}
      onSeek={onSeek}
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
        displayClips={useClips}
        currentTime={props.currentTime}
        onSeek={onSeek}
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

  return { view, row, windowStart, rerender, onSeek };
}

let rafQueue: FrameRequestCallback[] = [];
const flushRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  for (const cb of q) cb(performance.now());
};

beforeEach(() => {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1024,
  });
  (globalThis as unknown as { ResizeObserver: typeof ResizeObserver }).ResizeObserver =
    FakeResizeObserver as unknown as typeof ResizeObserver;
  rafQueue = [];
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
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

  it("does not yank the window back to the clip start when clicking a long clip in its middle", () => {
    // One 30s clip: the 12s window can only ever show a slice of it.
    const longClips: ClipData[] = [{ start: 0, end: 30, vStart: 0, vEnd: 30 }];
    const { row, windowStart, rerender } = renderRow({ clips: longClips });

    // Pan the window to anchor 5 (viewing the clip's middle slice, 5-17s).
    act(() => {
      fireEvent.pointerDown(row, {
        pointerId: 2,
        pointerType: "mouse",
        clientX: 250,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 2,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, { pointerId: 2, clientX: 0, clientY: 50 });
    });
    expect(windowStart()).toBe(5);

    // A pan swallows the click that ends it; emit (and discard) one so the
    // real click below is not suppressed.
    fireEvent.click(row);

    // Clicking the visible slice must not scroll the window back to the
    // clip's start (t=0) — play it where the user is looking at it.
    const clip = row.querySelector(".waveform-clip")!;
    fireEvent.click(clip);
    rerender({ playing: true });

    expect(windowStart()).toBe(5);
  });

  it("does not recenter the window when a short clip starts playing inside the view", () => {
    // A short clip the user is already looking at (window anchored at 4).
    const shortClips: ClipData[] = [
      { start: 6.63, end: 7.49, vStart: 6.63, vEnd: 7.49 },
    ];
    const { row, windowStart, rerender } = renderRow({
      clips: shortClips,
      initialTime: 0,
    });

    act(() => {
      fireEvent.pointerDown(row, {
        pointerId: 3,
        pointerType: "mouse",
        clientX: 200,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 3,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, { pointerId: 3, clientX: 0, clientY: 50 });
    });
    expect(windowStart()).toBe(4);

    // Settle the pan's trailing click suppression before the real click.
    fireEvent.click(row);

    // Click the clip; the playhead seeks from 0 to 6.63 and plays. The window
    // must stay where it is — the clip is already in view.
    const clip = row.querySelector(".waveform-clip")!;
    fireEvent.click(clip);
    rerender({ playing: true, currentTime: 6.63 });

    expect(windowStart()).toBe(4);
  });

  it("does not seek when clicking silence while a clip is playing", () => {
    const { row, rerender, onSeek } = renderRow();

    // Start clip playback, then click the empty track background ("silence").
    const firstClip = row.querySelector(".waveform-clip")!;
    fireEvent.click(firstClip);
    rerender({ playing: true });
    fireEvent.click(row.querySelector(".row-waveform__inner")!);

    expect(onSeek).not.toHaveBeenCalled();
  });

  it("does not move the window when clicking the track to set the cursor", () => {
    const { row, windowStart, rerender, onSeek } = renderRow({ initialTime: 0 });

    // Click the empty track at 85% across the 12s window (seek target 10.2).
    const inner = row.querySelector(".row-waveform__inner") as HTMLElement;
    Object.defineProperty(inner, "getBoundingClientRect", {
      value: () => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 200,
        width: 600,
        height: 200,
      }),
    });
    fireEvent.click(inner, { clientX: 510, clientY: 50 });
    expect(onSeek).toHaveBeenCalledWith(10.2);

    // The seek lands inside the window; even with playback running the window
    // must not re-center on the playhead afterwards.
    rerender({ playing: true, currentTime: 10.2 });
    act(() => flushRaf());

    expect(windowStart()).toBe(0);
  });

  it("auto-scrolls to keep the playhead in view while playing", () => {
    const { windowStart, rerender } = renderRow({ playing: true });

    // No hovering needed — the row keeps the playhead in view on its own.
    for (let t = 0.5; t <= 8; t += 0.5) {
      rerender({ currentTime: t });
      act(() => flushRaf());
    }
    // follow target at t=8 is 8 - 0.6*12 = 0.8.
    expect(windowStart()).toBeCloseTo(0.8);
  });

  it("auto-scrolls while a long clip is playing near the window edge", () => {
    // One 30s clip starting at the window's left edge (anchor 0). Clicking it
    // arms the follow end; while the playhead is in view the row must glide.
    const longClips: ClipData[] = [{ start: 0, end: 30, vStart: 0, vEnd: 30 }];
    const { row, windowStart, rerender } = renderRow({
      clips: longClips,
      initialTime: 0,
    });

    const clip = row.querySelector(".waveform-clip")!;
    fireEvent.click(clip);
    rerender({ playing: true });

    for (let t = 0.5; t <= 6; t += 0.5) {
      rerender({ currentTime: t });
      act(() => flushRaf());
    }
    // The playhead stays put on screen; the window slides with it (t - 0).
    expect(windowStart()).toBe(6);
  });

  it("resumes auto-scrolling after a clip ends when the view never moved", () => {
    // A short clip fully inside the (panned) view. After it finishes, the
    // resumed playback must keep following the playhead.
    const shortClips: ClipData[] = [
      { start: 6.63, end: 7.49, vStart: 6.63, vEnd: 7.49 },
    ];
    const { row, windowStart, rerender } = renderRow({
      clips: shortClips,
      initialTime: 0,
    });

    // Play the clip; its range runs inside the view.
    const clip = row.querySelector(".waveform-clip")!;
    fireEvent.click(clip);
    rerender({ playing: true, currentTime: 6.63 });
    // The clip range finishes (player pauses and reports its end time).
    rerender({ playing: false, currentTime: 7.49 });
    // Resume normal playback just past the clip end.
    rerender({ playing: true, currentTime: 7.5 });

    for (let t = 7.6; t <= 8; t += 0.2) {
      rerender({ currentTime: t });
      act(() => flushRaf());
    }
    // No frozen view after the clip: normal follow target at t=8 is 0.8.
    expect(windowStart()).toBeCloseTo(0.8);
  });
});