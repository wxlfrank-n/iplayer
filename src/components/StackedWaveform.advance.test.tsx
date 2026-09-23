// @vitest-environment jsdom

import { render, act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StackedWaveform } from "./StackedWaveform";
import type { WaveformData } from "../types";
import type { Clip as ClipData } from "../utils/clips";

class FakeResizeObserver {
  constructor(_cb: () => void) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

const waveform: WaveformData = {
  data: new Float32Array(12000),
  sampleRate: 100,
  duration: 120,
};

// 6 × 20s clips; each clip (20s > 10s row target) becomes its own row, and in
// jsdom clientHeight is 0 → rowsPerPage 1 → each row is one page.
const clips: ClipData[] = Array.from({ length: 6 }, (_, i) => ({
  start: i * 20,
  end: (i + 1) * 20,
  vStart: i * 20,
  vEnd: (i + 1) * 20,
}));

function setup(initialTime = 0) {
  const scrollTo = vi.fn();
  (
    HTMLElement.prototype as unknown as { scrollTo: typeof scrollTo }
  ).scrollTo = scrollTo;

  const props: React.ComponentProps<typeof StackedWaveform> = {
    waveform,
    displayClips: clips,
    currentTime: initialTime,
    playing: false,
    activeClip: -1,
    repetitions: 3,
    minSilenceLength: 0.1,
    onSeek: vi.fn(),
    onActiveClipChange: vi.fn(),
    onPlayRange: vi.fn(),
    onStopPlayback: vi.fn(),
    onSwipeClip: vi.fn(),
    getCurrentTime: () => props.currentTime,
  };

  const view = render(<StackedWaveform {...props} />);
  const scroller = view.container.querySelector(
    ".stacked-waveform",
  ) as HTMLDivElement;
  Object.defineProperty(scroller, "clientWidth", { value: 800 });

  const rerender = (partial: Partial<typeof props>) => {
    Object.assign(props, partial);
    view.rerender(<StackedWaveform {...props} />);
  };
  return { scrollTo, rerender, scroller };
}

beforeEach(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
    FakeResizeObserver;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("stacked waveform paged auto-advance", () => {
  it("scrolls to the next page when the live clock crosses a page end", async () => {
    const { scrollTo, rerender } = setup(0);
    rerender({ playing: true });
    scrollTo.mockClear();

    rerender({ currentTime: 25 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });

    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.lastCall?.[0].left).toBe(800);
  });

  it("never skips ahead to the last page through between-page gaps", async () => {
    const { scrollTo, rerender } = setup(0);
    rerender({ playing: true });
    scrollTo.mockClear();

    rerender({ currentTime: 21 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(800);

    rerender({ currentTime: 41 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(1600);

    rerender({ currentTime: 61 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(2400);
  });

  it("does not chase the playhead while the user manually browses an earlier page", async () => {
    const { scrollTo, rerender, scroller } = setup(0);
    rerender({ playing: true });
    scrollTo.mockClear();

    // Auto-advance to page 1 (t=21 crosses page 0's end at 20).
    rerender({ currentTime: 21 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(800);

    // Let the auto-scroll's own guard window expire, then drag back to page 0.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    scrollTo.mockClear();

    // Cross into page 2 while browsing page 0 — advance must be suppressed
    // (allow the drag window to lapse so override, not userScrolling, is what
    // blocks the follow).
    rerender({ currentTime: 41 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("resumes advancing once the user catches up to the playhead page", async () => {
    const { scrollTo, rerender, scroller } = setup(0);
    rerender({ playing: true });
    scrollTo.mockClear();

    // Manual browse to page 0 while the playhead is on page 1.
    scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    rerender({ currentTime: 21 });
    // Split the expiry/flush: the 1500ms drag window lapses and the follow loop
    // restarts, then a separate advance lets the new loop's ticks actually run.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockClear();

    // User scrolls to page 1 where the playhead is now -> in sync, override clears.
    scroller.scrollLeft = 800;
    fireEvent.scroll(scroller);
    rerender({ currentTime: 21 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    scrollTo.mockClear();

    // Crossing page 1's end advances again.
    rerender({ currentTime: 41 });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(1600);
  });
});