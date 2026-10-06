// @vitest-environment jsdom

import {render, act, fireEvent} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import {StackedWaveform} from './StackedWaveform';
import type {WaveformData} from '../types';
import type {Clip as InitClipData} from '../utils/clips';
import analysisReducer from '../store/analysisSlice';
import configReducer from '../store/configSlice';
import playerReducer from '../store/playerSlice';

function makeStore() {
  return configureStore({
    reducer: {
      analysis: analysisReducer,
      config: configReducer,
      player: playerReducer,
    },
  });
}

class FakeResizeObserver {
  constructor() {}
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
const clips: InitClipData[] = Array.from({length: 6}, (_, i) => ({
  start: i * 20,
  end: (i + 1) * 20,
  vStart: i * 20,
  vEnd: (i + 1) * 20,
}));

function setup(initialTime = 0) {
  const scrollTo = vi.fn();
  (HTMLElement.prototype as unknown as {scrollTo: typeof scrollTo}).scrollTo =
    scrollTo;

  const setPointerCapture = vi.fn();
  (
    HTMLElement.prototype as unknown as {
      setPointerCapture: typeof setPointerCapture;
    }
  ).setPointerCapture = setPointerCapture;

  const onSeek = vi.fn();
  const props: React.ComponentProps<typeof StackedWaveform> = {
    waveform,
    displayClips: clips,
    currentTime: initialTime,
    playing: false,
    activeClip: -1,
    repetitions: 3,
    onSeek,
    onActiveClipChange: vi.fn(),
    onPlayRange: vi.fn(),
    onStopPlayback: vi.fn(),
    onSwipeClip: vi.fn(),
    getCurrentTime: () => props.currentTime,
  };

  const store = makeStore();
  const view = render(
    <Provider store={store}>
      <StackedWaveform {...props} />
    </Provider>,
  );
  const scroller = view.container.querySelector(
    '.stacked-waveform',
  ) as HTMLDivElement;
  Object.defineProperty(scroller, 'clientWidth', {value: 800});

  const rerender = (partial: Partial<typeof props>) => {
    Object.assign(props, partial);
    view.rerender(
      <Provider store={store}>
        <StackedWaveform {...props} />
      </Provider>,
    );
  };
  return {scrollTo, setPointerCapture, rerender, scroller, onSeek};
}

beforeEach(() => {
  (globalThis as unknown as {ResizeObserver: unknown}).ResizeObserver =
    FakeResizeObserver;
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('stacked waveform paged auto-advance', () => {
  it('scrolls to the target page when skipping while paused', async () => {
    const {scrollTo, rerender} = setup(0);
    scrollTo.mockClear();

    rerender({currentTime: 45});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(scrollTo).toHaveBeenCalledWith({left: 1600, behavior: 'smooth'});
  });

  it('scrolls to the next page when the live clock crosses a page end', async () => {
    const {scrollTo, rerender} = setup(0);
    rerender({playing: true});
    scrollTo.mockClear();

    rerender({currentTime: 25});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });

    expect(scrollTo).toHaveBeenCalled();
    expect(scrollTo.mock.lastCall?.[0].left).toBe(800);
  });

  it('never skips ahead to the last page through between-page gaps', async () => {
    const {scrollTo, rerender} = setup(0);
    rerender({playing: true});
    scrollTo.mockClear();

    rerender({currentTime: 21});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(800);

    rerender({currentTime: 41});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(1600);

    rerender({currentTime: 61});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(2400);
  });

  it('does not chase the playhead while the user manually browses an earlier page', async () => {
    const {scrollTo, rerender, scroller} = setup(0);
    rerender({playing: true});
    scrollTo.mockClear();

    // Auto-advance to page 1 (t=21 crosses page 0's end at 20).
    rerender({currentTime: 21});
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
    rerender({currentTime: 41});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('resumes advancing once the user catches up to the playhead page', async () => {
    const {scrollTo, rerender, scroller} = setup(0);
    rerender({playing: true});
    scrollTo.mockClear();

    // Manual browse to page 0 while the playhead is on page 1.
    scroller.scrollLeft = 0;
    fireEvent.scroll(scroller);
    rerender({currentTime: 21});
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
    rerender({currentTime: 21});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    scrollTo.mockClear();

    // Crossing page 1's end advances again.
    rerender({currentTime: 41});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(48);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(1600);
  });

  it("does not snap back to the playing clip's page once the user scrolls away", async () => {
    const {scrollTo, rerender, scroller} = setup(0);

    // Click clip 0's rect to start its (repeating) clip playback.
    const firstClip = scroller.querySelector('.waveform-clip')!;
    fireEvent.click(firstClip);
    rerender({playing: true, activeClip: 0, currentTime: 0});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    // Let the "select active clip" auto-scroll guard lapse before browsing.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1100);
    });
    expect(scrollTo.mock.lastCall?.[0].left).toBe(0);

    // User scrolls to clip 4's page while clip 0 keeps playing.
    scroller.scrollLeft = 3200;
    fireEvent.scroll(scroller);
    scrollTo.mockClear();

    // The clip's clock wraps when it repeats: currentTime jumps back to ~0.
    rerender({currentTime: 20});
    rerender({currentTime: 0.5});
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(scrollTo).not.toHaveBeenCalled();
  });

  it('does not seek when clicking a row background while a clip is playing', () => {
    const {scroller, rerender, onSeek} = setup(0);

    // Start clip 0's repeating playback by clicking its rect.
    const firstClip = scroller.querySelector('.waveform-clip')!;
    fireEvent.click(firstClip);
    rerender({playing: true, activeClip: 0, currentTime: 0});

    // Click the row background (silence) — must not seek while the clip plays.
    fireEvent.click(scroller.querySelector('.stacked-waveform__row')!);

    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does not start a page drag from a buttonless move after a clip tap', () => {
    const {scrollTo, setPointerCapture, scroller} = setup(0);

    const clip = scroller.querySelector('.waveform-clip')!;

    // Tap the clip once, then tap it again. Clip swallows pointerup (so the
    // scroller's dragRef is left dangling) and stops the clip on the repeat.
    fireEvent.pointerDown(clip, {
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 50,
    });
    fireEvent.pointerUp(clip, {
      pointerId: 1,
      button: 0,
      buttons: 0,
      clientX: 100,
      clientY: 50,
    });
    fireEvent.pointerDown(clip, {
      pointerId: 1,
      button: 0,
      buttons: 1,
      clientX: 100,
      clientY: 50,
    });
    fireEvent.pointerUp(clip, {
      pointerId: 1,
      button: 0,
      buttons: 0,
      clientX: 100,
      clientY: 50,
    });

    scrollTo.mockClear();
    setPointerCapture.mockClear();

    // A plain mouse glide (no buttons pressed) moves far horizontally. It must
    // not be mistaken for a horizontal page drag.
    fireEvent.pointerMove(scroller, {
      pointerId: 1,
      clientX: 500,
      clientY: 50,
    });

    expect(setPointerCapture).not.toHaveBeenCalled();
    expect(scrollTo).not.toHaveBeenCalled();
  });
});
