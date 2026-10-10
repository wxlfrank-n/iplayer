import {describe, expect, it} from 'vitest';
import {
  clampWindowAnchor,
  getBaseWindowSecs,
  getWindowSecs,
} from './rowWaveform';
import type {Clip} from './clips';

/**
 * `count` clips of `length` seconds each, laid out end to end.
 *
 * `getWindowSecs` divides the track duration by the clip count, so the
 * individual boundaries do not matter.
 */
function clips(count: number, length = 1): Clip[] {
  return Array.from({length: count}, (_, i) => ({
    start: i * length,
    end: (i + 1) * length,
    vStart: i * length,
    vEnd: (i + 1) * length,
  }));
}

describe('getBaseWindowSecs', () => {
  const cases: Array<[number, number]> = [
    [400, 12],
    [799, 12],
    [800, 12],
    [1199, 12],
    [1200, 16],
    [1599, 16],
    [1600, 32],
    [2560, 32],
  ];

  it.each(cases)(
    'width %s gives a base window of %s seconds',
    (width, expected) => {
      expect(getBaseWindowSecs(width)).toBe(expected);
    },
  );
});

describe('getWindowSecs', () => {
  /*
   * With `avg = waveformDuration / clipCount`, the window is
   *
   *     avg * width / ((avg - 0.1) * ratio + 60)
   *
   * where `ratio = (width - 60) / (baseWindowSecs - 0.1)`. The result is capped
   * at the base window and floored at `0.1 * width / 60`.
   *
   * The anchors are chosen so the density term lands exactly on round numbers:
   * at 600px the base window is 12s and `ratio = 540 / 11.9`, so an average
   * clip of 12s works out to a 600px density window and therefore a 12s
   * viewport.
   */
  const densityCases: Array<[number, number, number, number]> = [
    // [width, clipCount, waveformDuration, expected]
    // Long average clips: the base window caps the result.
    [600, 1, 120, 12],
    [600, 2, 120, 12],
    [600, 10, 120, 12],
    // The break-even point: avg 12s at 600px is exactly the base window.
    [600, 20, 120, 10.984615],
    [600, 60, 120, 8.206897],
    [600, 120, 120, 5.950024],
    // The floor wins: 600px floors at 0.1 * 600 / 60 = 1s.
    [600, 600, 120, 1.859375],
    [600, 1200, 120, 1],
    [600, 2400, 120, 1],
    // A wider row scales the floor: 1200px floors at 0.1 * 1200 / 60 = 2s.
    [1200, 30, 120, 14.133333],
    [1200, 6000, 120, 2],
    // A 1600px row allows the longest base window, and its density term
    // (avg 30s) lands just under it rather than being capped.
    [1600, 4, 120, 31.926606],
  ];

  it.each(densityCases)(
    'width %s with %s clips over %s seconds shows %s seconds',
    (width, count, duration, expected) => {
      expect(getWindowSecs(width, clips(count), duration)).toBeCloseTo(
        expected,
        4,
      );
    },
  );

  const baseCases: Array<[number, number]> = [
    [400, 12],
    [800, 12],
    [1200, 16],
    [1600, 32],
  ];

  it.each(baseCases)(
    'width %s with no clips shows the base window of %s seconds',
    (width, expected) => {
      // No clips: density does not apply, whatever the duration.
      expect(getWindowSecs(width, [], 120)).toBe(expected);
      expect(getWindowSecs(width, [], 0)).toBe(expected);
    },
  );

  it('falls back to the width-derived floor when the duration is zero', () => {
    // A zero duration makes the average clip length zero, so the density term
    // collapses and only the floor is left: 1s at 600px.
    expect(getWindowSecs(600, clips(4), 0)).toBe(1);
  });

  it('never returns less than the width-derived floor', () => {
    const floor = (0.1 * 600) / 60;

    expect(getWindowSecs(600, clips(2400), 120)).toBeGreaterThanOrEqual(floor);
    expect(getWindowSecs(600, clips(4), 0)).toBeGreaterThanOrEqual(floor);
  });

  it('never returns more than the base window', () => {
    expect(getWindowSecs(600, clips(1), 1200)).toBeLessThanOrEqual(12);
    expect(getWindowSecs(1600, clips(1), 120)).toBeLessThanOrEqual(32);
  });

  /*
   * Clip scope sizes the window off the local neighbourhood around the selected
   * clip instead of the whole track.
   */
  describe('clip scope neighbourhood', () => {
    // Mirror of the documented density formula, for an explicit average.
    const windowForAvg = (width: number, avg: number) => {
      const base = getBaseWindowSecs(width);
      const minWindowSecs = (0.1 * width) / 60;
      const ratio = (width - 60) / (base - 0.1);
      const densityWindowPx = (avg - 0.1) * ratio + 60;
      const densityWindowSecs = (avg * width) / densityWindowPx;
      return Math.max(minWindowSecs, Math.min(base, densityWindowSecs));
    };

    /*
     * Lay clips out in time order with `gap` seconds of silence between them, so
     * the bounding span a neighbourhood covers includes those gaps.
     */
    const spaced = (durations: number[], gap = 0): Clip[] => {
      let time = 0;

      return durations.map(duration => {
        const start = time;
        const end = time + duration;
        time = end + gap;

        return {start, end, vStart: start, vEnd: end};
      });
    };

    // 30 one-second clips, half a second apart.
    const track = () => spaced(Array(30).fill(1), 0.5);

    it('averages the bounding span of the clips around the selected clip', () => {
      const list = track();

      // Neighbourhood is clips 5..14: spans 7.5s..22s, so 14.5s over 10 clips.
      expect(
        getWindowSecs(600, list, 120, {activeClip: 10, mergeScope: 'clip'}),
      ).toBeCloseTo(windowForAvg(600, 1.45), 4);
    });

    it('ignores clips outside the neighbourhood', () => {
      const list = track();
      const expected = getWindowSecs(600, list, 120, {
        activeClip: 10,
        mergeScope: 'clip',
      });

      // A huge outlier far from the selection must not move the window.
      list[0] = {start: 0, end: 100, vStart: 0, vEnd: 100};

      expect(
        getWindowSecs(600, list, 120, {activeClip: 10, mergeScope: 'clip'}),
      ).toBe(expected);
    });

    it('clamps the neighbourhood at the start of the track', () => {
      const list = track();

      // Clip 3 has only clips 0..9 to its left, so the span is 0s..14.5s.
      expect(
        getWindowSecs(600, list, 120, {activeClip: 3, mergeScope: 'clip'}),
      ).toBeCloseTo(windowForAvg(600, 1.45), 4);
    });

    it('uses the whole-track average in global scope', () => {
      const list = track();

      // Track average is 120 / 30 = 4s, independent of the selection.
      expect(
        getWindowSecs(600, list, 120, {activeClip: 10, mergeScope: 'global'}),
      ).toBeCloseTo(windowForAvg(600, 4), 4);
    });

    it('falls back to the whole-track average without a selected clip', () => {
      const list = track();
      const plain = getWindowSecs(600, list, 120);

      expect(
        getWindowSecs(600, list, 120, {activeClip: -1, mergeScope: 'clip'}),
      ).toBe(plain);
      expect(
        getWindowSecs(600, list, 120, {activeClip: 99, mergeScope: 'clip'}),
      ).toBe(plain);
    });

    it('still caps the window at the base window', () => {
      // Every clip is 20s, so the neighbourhood average is 20s and the density
      // term wants more than the 12s base window at 600px.
      const list = spaced(Array(30).fill(20));

      expect(
        getWindowSecs(600, list, 120, {activeClip: 5, mergeScope: 'clip'}),
      ).toBe(windowForAvg(600, 20));
      expect(
        getWindowSecs(600, list, 120, {activeClip: 5, mergeScope: 'clip'}),
      ).toBeLessThanOrEqual(12);
    });
  });
});

describe('clampWindowAnchor', () => {
  const cases: Array<[number, number, number]> = [
    [0, 40, 0],
    [10, 40, 10],
    [45, 40, 40],
    [-5, 40, 0],
  ];

  it.each(cases)(
    'clamps anchor %s using maxStart %s to %s',
    (anchor, maxStart, expected) => {
      expect(clampWindowAnchor(anchor, maxStart)).toBe(expected);
    },
  );
});
