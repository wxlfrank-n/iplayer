// @vitest-environment jsdom

import {act, fireEvent, render} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {configureStore} from '@reduxjs/toolkit';
import {Provider} from 'react-redux';
import {RowWaveform} from './RowWaveform';
import type {WaveformData} from '../hooks/useWaveform';
import type {Clip as InitClipData} from '../utils/clips';
import {getWindowSecs} from '../utils/rowWaveform';
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

vi.mock('./Clips', () => ({
  Clips: () => <div className="waveform-clip" />,
}));
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

const clips: InitClipData[] = [{start: 1, end: 3, vStart: 1, vEnd: 3}];

function renderRow({playing = false, currentTime = 0} = {}) {
  const props = {
    playing,
    currentTime,
  };
  const view = render(
    <Provider store={makeStore()}>
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
        scrollTimeoutRef={{current: undefined}}
      />
    </Provider>,
  );
  const row = view.container.querySelector('.row-waveform') as HTMLDivElement;
  Object.defineProperty(row, 'clientWidth', {value: 600});
  const inner = row.querySelector('.row-waveform__inner') as HTMLElement;
  Object.defineProperty(inner, 'clientWidth', {value: 600});
  // The rendered buffer is translated by -(viewportAnchor - bufferStart)*pxPerSec;
  // recover the live viewport anchor from the track transform.
  const viewportStart = () => {
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
      clips,
      waveform.duration,
    );
    const pxPerSec = (inner.clientWidth || 1) / win;
    return buffer - px / pxPerSec;
  };
  const rerender = (next: Partial<typeof props>) => {
    Object.assign(props, next);
    view.rerender(
      <Provider store={makeStore()}>
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
          scrollTimeoutRef={{current: undefined}}
        />
      </Provider>,
    );
  };
  // clientWidth is patched post-mount; one extra render lets the width effect
  // settle on the 600px window (12s) before the test interacts.
  rerender({});
  return {
    ...view,
    row,
    track: row.querySelector('.row-waveform__track') as HTMLElement,
    clip: view.container.querySelector('.waveform-clip')!,
    viewportStart,
    rerender,
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

describe('RowWaveform clip dragging', () => {
  it('scrolls the row when dragging a clip horizontally', () => {
    const {clip, viewportStart} = renderRow();

    fireEvent.pointerDown(clip, {
      pointerId: 1,
      pointerType: 'mouse',
      clientX: 150,
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
    act(() => flushRaf());

    expect(viewportStart()).toBe(3);
  });

  it('does not scroll horizontally for a vertical clip swipe', () => {
    const {clip, viewportStart} = renderRow();

    fireEvent.pointerDown(clip, {
      pointerId: 2,
      pointerType: 'touch',
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

    expect(viewportStart()).toBe(0);
  });

  it('does not scroll horizontally for a 15-75 degree diagonal clip swipe', () => {
    const {clip, viewportStart} = renderRow();

    // 35 degrees above the horizontal (ratio 0.7), inside the diagonal band.
    fireEvent.pointerDown(clip, {
      pointerId: 9,
      pointerType: 'touch',
      clientX: 100,
      clientY: 50,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 9,
        clientX: 150,
        clientY: 15,
      });
      fireEvent.pointerMove(window, {
        pointerId: 9,
        clientX: 160,
        clientY: 10,
      });
    });

    expect(viewportStart()).toBe(0);
  });

  it('starts scrolling from the row viewport even when the track is transformed', () => {
    const {track, viewportStart} = renderRow();

    fireEvent.pointerDown(track, {
      pointerId: 3,
      pointerType: 'mouse',
      clientX: 150,
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
    act(() => flushRaf());

    expect(viewportStart()).toBe(3);
  });

  it('keeps a manual drag in control when playback time is outside the window', () => {
    const {track, rerender, viewportStart} = renderRow({
      playing: true,
      currentTime: 60,
    });

    fireEvent.pointerDown(track, {
      pointerId: 4,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 50,
      button: 0,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 4,
        clientX: 0,
        clientY: 50,
      });
      rerender({currentTime: 61});
    });
    act(() => flushRaf());

    expect(viewportStart()).toBe(3);
  });

  it('does not scroll when the swipe starts above the track (dancing line area)', () => {
    const {row, viewportStart} = renderRow();

    fireEvent.pointerDown(row, {
      pointerId: 5,
      pointerType: 'mouse',
      clientX: 150,
      clientY: 50,
      button: 0,
    });
    act(() => {
      fireEvent.pointerMove(window, {
        pointerId: 5,
        clientX: 0,
        clientY: 50,
      });
    });
    act(() => flushRaf());

    expect(viewportStart()).toBe(0);
  });

  it('plays the clip described by a clipPlayRequest', () => {
    const onPlayRange = vi.fn();

    render(
      <Provider store={makeStore()}>
        <RowWaveform
          waveform={waveform}
          displayClips={clips}
          currentTime={0}
          onSeek={vi.fn()}
          onPlayRange={onPlayRange}
          repetitions={3}
          activeClip={-1}
          onActiveClipChange={vi.fn()}
          getCurrentTime={() => 0}
          playing={false}
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{current: undefined}}
          clipPlayRequest={{clip: clips[0], repetitions: 3, nonce: 1}}
        />
      </Provider>,
    );

    expect(onPlayRange).toHaveBeenCalledWith(
      clips[0].vStart,
      clips[0].vEnd,
      3,
      expect.any(Function),
      expect.any(Function),
    );
  });

  it('ignores a repeated clipPlayRequest nonce', () => {
    const onPlayRange = vi.fn();
    const request = {clip: clips[0], repetitions: 3, nonce: 7};

    const {rerender} = render(
      <Provider store={makeStore()}>
        <RowWaveform
          waveform={waveform}
          displayClips={clips}
          currentTime={0}
          onSeek={vi.fn()}
          onPlayRange={onPlayRange}
          repetitions={3}
          activeClip={-1}
          onActiveClipChange={vi.fn()}
          getCurrentTime={() => 0}
          playing={false}
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{current: undefined}}
          clipPlayRequest={request}
        />
      </Provider>,
    );

    expect(onPlayRange).toHaveBeenCalledTimes(1);

    // A fresh object carrying an already-handled nonce must not replay.
    rerender(
      <Provider store={makeStore()}>
        <RowWaveform
          waveform={waveform}
          displayClips={clips}
          currentTime={0}
          onSeek={vi.fn()}
          onPlayRange={onPlayRange}
          repetitions={3}
          activeClip={-1}
          onActiveClipChange={vi.fn()}
          getCurrentTime={() => 0}
          playing={false}
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{current: undefined}}
          clipPlayRequest={{...request}}
        />
      </Provider>,
    );

    expect(onPlayRange).toHaveBeenCalledTimes(1);
  });

  it('replays the same clip when the request nonce advances', () => {
    const onPlayRange = vi.fn();

    const {rerender} = render(
      <Provider store={makeStore()}>
        <RowWaveform
          waveform={waveform}
          displayClips={clips}
          currentTime={0}
          onSeek={vi.fn()}
          onPlayRange={onPlayRange}
          repetitions={3}
          activeClip={-1}
          onActiveClipChange={vi.fn()}
          getCurrentTime={() => 0}
          playing={false}
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{current: undefined}}
          clipPlayRequest={{clip: clips[0], repetitions: 3, nonce: 1}}
        />
      </Provider>,
    );

    expect(onPlayRange).toHaveBeenCalledTimes(1);

    rerender(
      <Provider store={makeStore()}>
        <RowWaveform
          waveform={waveform}
          displayClips={clips}
          currentTime={0}
          onSeek={vi.fn()}
          onPlayRange={onPlayRange}
          repetitions={3}
          activeClip={-1}
          onActiveClipChange={vi.fn()}
          getCurrentTime={() => 0}
          playing={false}
          scrolling={false}
          setScrolling={vi.fn()}
          scrollTimeoutRef={{current: undefined}}
          clipPlayRequest={{clip: clips[0], repetitions: 3, nonce: 2}}
        />
      </Provider>,
    );

    expect(onPlayRange).toHaveBeenCalledTimes(2);
  });
});
