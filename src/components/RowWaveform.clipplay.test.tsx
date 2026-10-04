// @vitest-environment jsdom

import {act, fireEvent, render} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {RowWaveform} from './RowWaveform';
import type {WaveformData} from '../hooks/useWaveform';
import type {Clip as ClipData} from '../utils/clips';
import {getWindowSecs} from '../utils/rowWaveform';

vi.mock('./ClipLabel', () => ({
  ClipLabel: () => null,
}));
vi.mock('./DancingLines', () => ({
  DancingLines: () => null,
}));
vi.mock('./WaveformCursor', () => ({
  WaveformCursor: () => null,
}));
vi.mock('./Waveform', () => ({
  WaveformCanvas: ({window}: {window: {windowStartSec: number}}) => (
    <div data-window-start={window.windowStartSec} />
  ),
}));

class FakeResizeObserver {
  constructor() {}
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
  {start: 10, end: 20, vStart: 10, vEnd: 20},
  {start: 90, end: 100, vStart: 90, vEnd: 100},
];

function renderRow({
  initialTime = 10,
  playing = false,
  clips: useClips = clips,
} = {}) {
  const props = {
    currentTime: initialTime,
    playing,
  };
  const onSeek = vi.fn();
  let scrolling = false;
  const setScrolling: React.Dispatch<React.SetStateAction<boolean>> = v => {
    scrolling = typeof v === 'function' ? v(scrolling) : v;
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
      scrollTimeoutRef={{current: undefined}}
    />,
  );
  const row = view.container.querySelector('.row-waveform') as HTMLDivElement;
  Object.defineProperty(row, 'clientWidth', {value: 600});
  const inner = row.querySelector('.row-waveform__inner') as HTMLElement;
  Object.defineProperty(inner, 'clientWidth', {value: 600});
  // The rendered buffer is translated by -(viewportAnchor - bufferStart)*pxPerSec;
  // recover the live viewport anchor from the track transform.
  const windowStart = () => {
    const buffer = Number(
      row
        .querySelector('[data-window-start]')
        ?.getAttribute('data-window-start') ?? 0,
    );
    const track = row.querySelector('.row-waveform__track') as HTMLElement;
    const transform = track?.style.transform ?? '';
    const m = transform.match(/translate3d\((-?[0-9.]+)px/);
    const px = m ? Number(m[1]) : 0;
    const win = getWindowSecs(
      row.clientWidth || window.innerWidth,
      useClips,
      waveform.duration,
    );
    const pxPerSec = (inner.clientWidth || 1) / win;
    return buffer - px / pxPerSec;
  };

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
        scrollTimeoutRef={{current: undefined}}
      />,
    );
  };

  // clientWidth is patched post-mount; one extra render lets the width effect
  // settle on the 600px window before the test interacts.
  rerender({});

  return {
    view,
    row,
    track: row.querySelector('.row-waveform__track') as HTMLElement,
    windowStart,
    rerender,
    onSeek,
  };
}

let rafQueue: FrameRequestCallback[] = [];
const flushRaf = () => {
  const q = rafQueue;
  rafQueue = [];
  for (const cb of q) cb(performance.now());
};

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: 1024,
  });
  (
    globalThis as unknown as {ResizeObserver: typeof ResizeObserver}
  ).ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
  rafQueue = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
    rafQueue.push(cb);
    return rafQueue.length;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('RowWaveform clip play follow', () => {
  it('does not yank the window back to the playing clip after the user pans away', () => {
    const {row, track, windowStart, rerender} = renderRow();

    // Play clip 1 by clicking its rect (10-20s). The clip lies entirely to
    // the right of the 8s window, so arming keeps the current anchor (0) and
    // arms 80% following instead of jumping to the clip.
    const firstClip = row.querySelector('.waveform-clip')!;
    fireEvent.click(firstClip);
    rerender({playing: true});
    act(() => {
      // Pan right to ~30s (2250px at 75px/s from anchor 0).
      fireEvent.pointerDown(track, {
        pointerId: 1,
        pointerType: 'mouse',
        clientX: 2250,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 1,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, {pointerId: 1, clientX: 0, clientY: 50});
    });
    act(() => flushRaf());
    expect(windowStart()).toBeCloseTo(30, 3);

    // The clip's clock wraps when it repeats: currentTime jumps 19 -> 10.5,
    // which must NOT scroll the view back toward the clip.
    rerender({currentTime: 19});
    rerender({currentTime: 10.5});
    act(() => {
      fireEvent.pointerMove(window, {clientX: 0, clientY: 50});
    });

    expect(windowStart()).toBeCloseTo(30, 3);
  });

  it("snaps the window to a long clip's start when clicking it in the middle", () => {
    // One 30s clip: the 8s window can only ever show a slice of it.
    const longClips: ClipData[] = [{start: 0, end: 30, vStart: 0, vEnd: 30}];
    const {row, track, windowStart, rerender} = renderRow({clips: longClips});

    // Pan the window to anchor 5 (viewing the clip's middle slice, 5-13s).
    act(() => {
      fireEvent.pointerDown(track, {
        pointerId: 2,
        pointerType: 'mouse',
        clientX: 375,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 2,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, {pointerId: 2, clientX: 0, clientY: 50});
    });
    act(() => flushRaf());
    expect(windowStart()).toBe(5);

    // A pan swallows the click that ends it; emit (and discard) one so the
    // real click below is not suppressed.
    fireEvent.click(row);

    // The clip's left edge lies left of the window, so arming snaps back to
    // the clip start (0) and arms 80% following.
    const clip = row.querySelector('.waveform-clip')!;
    fireEvent.click(clip);
    rerender({playing: true});

    expect(windowStart()).toBeCloseTo(0, 3);
  });

  it('releases the pan on a clip tap so later mouse moves do not scroll', () => {
    const {row, windowStart} = renderRow();

    // A tap on a clip: the clip's pointerup handler stopPropagation's (it
    // starts clip playback), which must not leave the row pan armed. With a
    // bubble-phase release on window the follow-up mouse move — no button —
    // would drag the window to the right.
    const clip = row.querySelector('.waveform-clip')!;
    act(() => {
      fireEvent.pointerDown(clip, {
        pointerId: 9,
        pointerType: 'mouse',
        clientX: 300,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerUp(clip, {pointerId: 9, clientX: 300, clientY: 50});
    });
    act(() => {
      fireEvent.pointerMove(window, {clientX: 600, clientY: 50});
    });

    expect(windowStart()).toBe(0);
  });

  it('does not recenter the window when a short clip starts playing inside the view', () => {
    // A short clip the user is already looking at (window anchored at 4).
    const shortClips: ClipData[] = [
      {start: 6.63, end: 7.49, vStart: 6.63, vEnd: 7.49},
    ];
    const {row, track, windowStart, rerender} = renderRow({
      clips: shortClips,
      initialTime: 0,
    });

    act(() => {
      fireEvent.pointerDown(track, {
        pointerId: 3,
        pointerType: 'mouse',
        clientX: 300,
        clientY: 50,
        button: 0,
      });
      fireEvent.pointerMove(window, {
        pointerId: 3,
        clientX: 0,
        clientY: 50,
      });
      fireEvent.pointerUp(window, {pointerId: 3, clientX: 0, clientY: 50});
    });
    act(() => flushRaf());
    // Clip density over the 120s track gives 600 * 120 / (2 * 1) = 36000s, far
    // above the 8s base window, so the width alone sets the window here. Panning
    // 300px at win/600 px-per-second moves 300 * win / 600.
    const win = getWindowSecs(600, shortClips, waveform.duration);
    const panStart = 300 * (win / 600);
    expect(windowStart()).toBeCloseTo(panStart, 3);

    // Settle the pan's trailing click suppression before the real click.
    fireEvent.click(row);

    // Click the clip; the playhead seeks from 0 to 6.63 and plays. The window
    // must stay where it is — the clip is already in view.
    const clip = row.querySelector('.waveform-clip')!;
    fireEvent.click(clip);
    rerender({playing: true, currentTime: 6.63});

    expect(windowStart()).toBeCloseTo(panStart, 3);
  });

  it('does not seek when clicking silence while a clip is playing', () => {
    const {row, rerender, onSeek} = renderRow();

    // Start clip playback, then click the empty track background ("silence").
    const firstClip = row.querySelector('.waveform-clip')!;
    fireEvent.click(firstClip);
    rerender({playing: true});
    fireEvent.click(row.querySelector('.row-waveform__inner')!);

    expect(onSeek).not.toHaveBeenCalled();
  });

  it('does not move the window when clicking the track, and follows once playback resumes', () => {
    const {row, windowStart, rerender, onSeek} = renderRow({initialTime: 0});

    // Click the empty track at 85% across the 8s window (seek target 6.8).
    // The click handler lives on the track, so that is what it measures.
    const track = row.querySelector('.row-waveform__track') as HTMLElement;
    Object.defineProperty(track, 'getBoundingClientRect', {
      value: () => ({
        left: 0,
        top: 0,
        right: 600,
        bottom: 200,
        width: 600,
        height: 200,
      }),
    });
    fireEvent.click(track, {clientX: 510, clientY: 50});
    expect(onSeek).toHaveBeenCalledWith(6.8);

    // While paused, the click's cursor-hold keeps the viewport stationary:
    // the seek lands inside the window and must not re-center it.
    act(() => flushRaf());
    expect(windowStart()).toBe(0);

    // Resuming playback re-arms normal following. The playhead (6.8) is past
    // the 80% slot (6.4), so the window follows to 6.8 - 0.8*8 = 0.4.
    rerender({playing: true, currentTime: 6.8});
    act(() => flushRaf());

    expect(windowStart()).toBeCloseTo(0.4, 3);
  });

  it('auto-scrolls to keep the playhead in view while playing', () => {
    const {windowStart, rerender} = renderRow({playing: true, initialTime: 0});

    // No hovering needed — the row keeps the playhead in view on its own.
    for (let t = 0.5; t <= 8; t += 0.5) {
      rerender({currentTime: t});
      act(() => flushRaf());
    }
    // follow target at t=8 is 8 - 0.8*8 = 1.6 (the 80% follow slot).
    expect(windowStart()).toBeCloseTo(1.6, 3);
  });

  it('auto-scrolls while a long clip is playing near the window edge', () => {
    // One 30s clip starting at the window's left edge (anchor 0). Clicking it
    // arms 80% following; the window stays put until the playhead reaches the
    // right edge (threshold = 0 + 8 - 0.1 = 7.9s), then glides with it.
    const longClips: ClipData[] = [{start: 0, end: 30, vStart: 0, vEnd: 30}];
    const {row, windowStart, rerender} = renderRow({
      clips: longClips,
      initialTime: 0,
    });

    const clip = row.querySelector('.waveform-clip')!;
    fireEvent.click(clip);
    rerender({playing: true});

    for (let t = 0.5; t <= 9; t += 0.5) {
      rerender({currentTime: t});
      act(() => flushRaf());
    }
    // At t=9 the playhead has passed the 7.9s threshold; the window slides
    // with it so the playhead stays 0.1s inside the right edge (9 - 8 + 0.1).
    expect(windowStart()).toBeCloseTo(1.1, 3);
  });

  it('resumes auto-scrolling after a clip ends when the view never moved', () => {
    // A short clip fully inside the (panned) view. After it finishes, the
    // resumed playback must keep following the playhead.
    const shortClips: ClipData[] = [
      {start: 6.63, end: 7.49, vStart: 6.63, vEnd: 7.49},
    ];
    const {row, windowStart, rerender} = renderRow({
      clips: shortClips,
      initialTime: 0,
    });

    // Play the clip; its range runs inside the view.
    const clip = row.querySelector('.waveform-clip')!;
    fireEvent.click(clip);
    rerender({playing: true, currentTime: 6.63});
    // The clip range finishes (player pauses and reports its end time).
    rerender({playing: false, currentTime: 7.49});
    // Resume normal playback just past the clip end.
    rerender({playing: true, currentTime: 7.5});

    for (let t = 7.6; t <= 8; t += 0.2) {
      rerender({currentTime: t});
      act(() => flushRaf());
    }
    // One clip over the 120s track gives 600 * 120 / (2 * 1) = 36000s of density
    // headroom, so the window stays at the 8s base width. Pausing resets the
    // follow context; resuming keeps the same obeyed 80% follow slot, so at
    // t=8 the anchor is 8 - 0.8*8 = 1.6.
    expect(windowStart()).toBeCloseTo(1.6, 3);
  });

  it('does not jump the window when playback starts with a cursor inside it', () => {
    // A narrow screen gives an 8s window; a cursor placed at t=6 sits inside
    // a window that starts at 0. Starting playback must not re-anchor the
    // window to the 60% slot, which would jump it to 6 - 0.6*8 = 1.2.
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: 799,
    });
    const {windowStart, rerender} = renderRow({playing: true, initialTime: 6});

    // Playback starts with the cursor already in view: the window stays put.
    act(() => flushRaf());
    expect(windowStart()).toBe(0);

    // As the playhead advances, the window glides from the same on-screen
    // slot once the playhead passes the 80% threshold (6.4s).
    rerender({currentTime: 7});
    act(() => flushRaf());
    expect(windowStart()).toBeCloseTo(0.6, 3);
  });
});
