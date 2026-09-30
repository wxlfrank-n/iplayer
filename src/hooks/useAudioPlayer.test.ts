// @vitest-environment jsdom

import {act, renderHook} from '@testing-library/react';

import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {useAudioPlayer} from './useAudioPlayer';

/*
 * ------------------------------------------------------------
 * Redux
 * ------------------------------------------------------------
 */

const dispatch = vi.fn();

vi.mock('../store/hooks', () => ({
  useAppDispatch: () => dispatch,

  useAppSelector: () => ({
    tracks: [],
    currentTrackIndex: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 100,
  }),
}));

vi.mock('../store/store', () => ({
  store: {
    getState: () => ({
      player: {
        tracks: [],
        currentTrackIndex: -1,
        isPlaying: false,
        currentTime: 0,
        duration: 100,
      },
    }),
  },
}));

/*
 * Don't create a real WebAudio graph.
 */
vi.mock('../utils/audio', () => ({
  initializeAudioContext: vi.fn(() => {
    throw new Error('WebAudio disabled in test');
  }),

  decodeAudioBuffer: vi.fn(),
}));

vi.mock('../utils/wav', () => ({
  audioBufferToWavBlob: vi.fn(),
}));

/*
 * ------------------------------------------------------------
 * Fake Audio
 * ------------------------------------------------------------
 */

class FakeAudio extends EventTarget {
  currentTime = 0;

  duration = 100;

  paused = true;

  src = '';

  error = null;

  dataset: Record<string, string> = {};

  play = vi.fn(() => {
    this.paused = false;

    /*
     * snatchToStart() listens for this.
     */
    this.dispatchEvent(new Event('playing'));

    this.dispatchEvent(new Event('play'));

    return Promise.resolve();
  });

  pause = vi.fn(() => {
    this.paused = true;

    this.dispatchEvent(new Event('pause'));
  });

  load = vi.fn();
}

let audio: FakeAudio;

/*
 * ------------------------------------------------------------
 * RAF controller
 * ------------------------------------------------------------
 *
 * playRange doesn't advance time itself.
 * The browser/audio element does that.
 *
 * Therefore each test explicitly:
 *
 *   audio.currentTime = ...
 *   runRaf()
 */

let rafCallback: FrameRequestCallback | null = null;

function runRaf() {
  const cb = rafCallback;

  if (!cb) {
    throw new Error('No requestAnimationFrame callback scheduled');
  }

  rafCallback = null;

  act(() => {
    cb(performance.now());
  });
}

/*
 * Initial resetToStart() schedules a 50ms
 * resume timer.
 */
async function settleRestart() {
  await act(async () => {
    vi.advanceTimersByTime(50);

    await Promise.resolve();
  });

  /*
   * First RAF observes currentTime ~= start
   * and changes seeking -> false.
   */
  runRaf();
}

describe('useAudioPlayer.playRange', () => {
  beforeEach(() => {
    vi.useFakeTimers();

    dispatch.mockClear();

    audio = new FakeAudio();

    /*
     * useAudioPlayer creates:
     *
     * useRef(new Audio())
     */
    vi.stubGlobal('Audio', () => {
      return audio;
    });

    rafCallback = null;

    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((callback: FrameRequestCallback) => {
        rafCallback = callback;

        return 1;
      }),
    );

    vi.stubGlobal(
      'cancelAnimationFrame',
      vi.fn(() => {
        rafCallback = null;
      }),
    );
  });

  afterEach(() => {
    vi.useRealTimers();

    vi.unstubAllGlobals();
  });

  /*
   * ----------------------------------------------------------
   * Initial start
   * ----------------------------------------------------------
   */

  it('starts at the requested range start', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onComplete = vi.fn();

    const onRepeat = vi.fn();

    act(() => {
      result.current.playRange(10, 20, 3, onComplete, onRepeat);
    });

    expect(audio.currentTime).toBe(10);

    /*
     * Initial start is NOT a repeat.
     */
    expect(onRepeat).not.toHaveBeenCalled();

    expect(onComplete).not.toHaveBeenCalled();

    await settleRestart();

    expect(audio.play).toHaveBeenCalled();
  });

  /*
   * ----------------------------------------------------------
   * One repetition
   * ----------------------------------------------------------
   */

  it('returns to start and calls onRepeat after reaching end', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onComplete = vi.fn();

    const onRepeat = vi.fn();

    act(() => {
      result.current.playRange(10, 20, 3, onComplete, onRepeat);
    });

    /*
     * Finish initial seek.
     */
    await settleRestart();

    /*
     * Simulate normal playback.
     */
    audio.currentTime = 15;

    runRaf();

    expect(onRepeat).not.toHaveBeenCalled();

    /*
     * Reach range end.
     */
    audio.currentTime = 20;

    runRaf();

    /*
     * resetToStart(true)
     */
    expect(audio.currentTime).toBe(10);

    expect(onRepeat).toHaveBeenCalledTimes(1);

    expect(onComplete).not.toHaveBeenCalled();
  });

  /*
   * ----------------------------------------------------------
   * Multiple repetitions
   * ----------------------------------------------------------
   */

  it('plays the requested number of repetitions', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onComplete = vi.fn();

    const onRepeat = vi.fn();

    act(() => {
      result.current.playRange(10, 20, 3, onComplete, onRepeat);
    });

    /*
     * ROUND 1
     */
    await settleRestart();

    audio.currentTime = 20;

    runRaf();

    expect(onRepeat).toHaveBeenCalledTimes(1);

    expect(audio.currentTime).toBe(10);

    /*
     * ROUND 2
     */
    await settleRestart();

    audio.currentTime = 20;

    runRaf();

    expect(onRepeat).toHaveBeenCalledTimes(2);

    expect(audio.currentTime).toBe(10);

    /*
     * ROUND 3
     */
    await settleRestart();

    audio.currentTime = 20;

    runRaf();

    /*
     * Final round must NOT start
     * another repetition.
     */
    expect(onRepeat).toHaveBeenCalledTimes(2);

    expect(onComplete).toHaveBeenCalledTimes(1);

    expect(audio.currentTime).toBe(20);

    expect(audio.paused).toBe(true);
  });

  /*
   * ----------------------------------------------------------
   * Overshoot
   * ----------------------------------------------------------
   *
   * This is important for the issue you observed:
   *
   * RAF may observe 20.02 instead of exactly 20.
   */

  it('normalizes an overshot final repetition to the exact end', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onComplete = vi.fn();

    act(() => {
      result.current.playRange(10, 20, 1, onComplete);
    });

    await settleRestart();

    /*
     * Browser crossed the boundary
     * between two animation frames.
     */
    audio.currentTime = 20.037;

    runRaf();

    expect(audio.paused).toBe(true);

    /*
     * This is the important assertion.
     */
    expect(audio.currentTime).toBe(20);

    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  /*
   * ----------------------------------------------------------
   * Overshoot on a non-final repetition
   * ----------------------------------------------------------
   */

  it('restarts from exact start when an intermediate repetition overshoots end', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onRepeat = vi.fn();

    act(() => {
      result.current.playRange(10, 20, 2, undefined, onRepeat);
    });

    await settleRestart();

    audio.currentTime = 20.041;

    runRaf();

    expect(audio.currentTime).toBe(10);

    expect(onRepeat).toHaveBeenCalledTimes(1);
  });

  /*
   * ----------------------------------------------------------
   * ended event
   * ----------------------------------------------------------
   */

  it('handles a clip ending at the end of the audio file', async () => {
    const {result} = renderHook(() => useAudioPlayer(5));

    const onComplete = vi.fn();

    const onRepeat = vi.fn();

    act(() => {
      result.current.playRange(90, 100, 2, onComplete, onRepeat);
    });

    await settleRestart();

    /*
     * Browser reaches actual media end.
     */
    audio.currentTime = 100;

    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });

    expect(onRepeat).toHaveBeenCalledTimes(1);

    expect(audio.currentTime).toBe(90);

    /*
     * Second round.
     */
    await settleRestart();

    audio.currentTime = 100;

    act(() => {
      audio.dispatchEvent(new Event('ended'));
    });

    expect(onRepeat).toHaveBeenCalledTimes(1);

    expect(onComplete).toHaveBeenCalledTimes(1);

    expect(audio.currentTime).toBe(100);

    expect(audio.paused).toBe(true);
  });
});
