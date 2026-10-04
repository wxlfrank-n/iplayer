import {describe, expect, it} from 'vitest';
import {clampWindowAnchor, getWindowSecs} from './rowWaveform';
import type {Clip} from './clips';

/**
 * `count` clips of `length` seconds each, laid out end to end.
 *
 * `getWindowSecs` only cares how many clips survive the positive-duration
 * filter, so the individual boundaries do not matter.
 */
function clips(count: number, length = 1): Clip[] {
  return Array.from({length: count}, (_, i) => ({
    start: i * length,
    end: (i + 1) * length,
    vStart: i * length,
    vEnd: (i + 1) * length,
  }));
}

describe('getWindowSecs', () => {
  /*
   * The window is `width * waveformDuration / (2 * clipCount)`, floored at
   * `0.1 * width / 24` (a clip narrower than a tenth of its target width) and
   * capped at the width's base window.
   */
  const densityCases: Array<[number, number, number, number]> = [
    // [width, clipCount, waveformDuration, expected]
    // Sparse clips: the base window wins.
    [600, 2, 120, 8],
    [600, 1, 120, 8],
    [600, 8, 1, 8],
    [1600, 2, 120, 32],
    // Dense clips: 600 / (80 * 2) = 3.75s of headroom at 8 clips per 0.1s.
    [600, 8, 0.1, 3.75],
    // Right on the floor: the minimum scales with width, so 600px floors at
    // 0.1 * 600 / 24 = 2.5s.
    [600, 8, 0.05, 2.5],
    [600, 8, 0.075, 2.8125],
    // A wider row allows a longer minimum window: 0.1 * 1200 / 24 = 5s.
    [1200, 8, 0.01, 5],
    // A narrower row allows a shorter one: 0.1 * 400 / 24 = 1.667s, which this
    // 2.5s density clears.
    [400, 8, 0.1, 2.5],
  ];

  it.each(densityCases)(
    'width %s with %s clips over %s seconds shows %s seconds',
    (width, count, duration, expected) => {
      expect(getWindowSecs(width, clips(count), duration)).toBeCloseTo(
        expected,
        6,
      );
    },
  );

  const baseCases: Array<[number, number]> = [
    [400, 8],
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

  it('ignores clips with no duration', () => {
    const empty: Clip[] = [{start: 4, end: 4, vStart: 4, vEnd: 4}];

    expect(getWindowSecs(600, empty, 0.1)).toBe(8);
  });

  it('falls back to the minimum window when the duration is zero', () => {
    // Clips-per-second would be Infinity, so the density headroom collapses
    // to 0 and only the width-derived minimum is left.
    expect(getWindowSecs(600, clips(4), 0)).toBe(2.5);
  });

  it('never returns less than the width-derived minimum', () => {
    const win = getWindowSecs(600, clips(8), 0.05);
    expect(win).toBeGreaterThanOrEqual((0.1 * 600) / 24);
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
