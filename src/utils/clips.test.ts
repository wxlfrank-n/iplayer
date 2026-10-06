import {describe, expect, it} from 'vitest';
import {
  getClipGaps,
  expandClip,
  findMinMergeGap,
  mergeClipsByGap,
  mergeClipsByGapScoped,
  getInitClipData,
  type Clip,
} from './clips';

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

const bounds = (clips: Clip[]) => clips.map(c => [c.start, c.end]);

describe('getInitClipData', () => {
  const opts = {
    blockMs: 640,
    silenceRatio: 0.01,
    minClipLength: 0.3,
    minSplitPieceSec: 0.1,
  };

  // Builds a buffer of 64-sample blocks (the block size in samples at the
  // chosen sample rates: 640ms at 100Hz, 40ms at 1600Hz). Each block is a
  // constant amplitude (1 = sound, 0 = silence).
  const buildData = (amps: number[]): Float32Array => {
    const data = new Float32Array(amps.length * 64);
    amps.forEach((amp, b) => {
      for (let i = b * 64; i < (b + 1) * 64; i++) data[i] = amp;
    });
    return data;
  };

  it('returns an empty InitClipData when there is no data or a non-positive sample rate', () => {
    expect(getInitClipData(null, 44100, opts)).toEqual({
      clips: [],
      gaps: [],
      minGap: 0,
    });
    expect(getInitClipData(new Float32Array(0), 44100, opts)).toEqual({
      clips: [],
      gaps: [],
      minGap: 0,
    });
    expect(getInitClipData(buildData([1, 1]), 0, opts)).toEqual({
      clips: [],
      gaps: [],
      minGap: 0,
    });
  });

  it('detects a continuous run of sound as a single clip spanning the buffer', () => {
    const [clip] = getInitClipData(buildData([1, 1, 1]), 100, opts).clips;
    expect(clip.start).toBe(0);
    expect(clip.end).toBeCloseTo(1.92, 5);
    expect(clip.vStart).toBe(0);
    expect(clip.vEnd).toBeCloseTo(1.92, 5);
  });

  it('splits around a silent block and expands vStart/vEnd into the gap', () => {
    const {clips} = getInitClipData(buildData([1, 0, 1, 1]), 100, opts);
    expect(clips).toHaveLength(2);
    expect(bounds(clips)).toEqual([
      [0, 0.64],
      [1.28, 2.56],
    ]);
    // First clip expands into the following silence.
    expect(clips[0].vStart).toBe(0);
    expect(clips[0].vEnd).toBeCloseTo(0.8, 5);
    // Second clip expands into the preceding silence.
    expect(clips[1].vStart).toBeCloseTo(1.12, 5);
    expect(clips[1].vEnd).toBeCloseTo(2.56, 5);
  });

  it('trims leading and trailing silence and expands into it by 25% of each gap', () => {
    const [clip] = getInitClipData(buildData([0, 1, 0]), 100, opts).clips;
    expect(bounds([clip])).toEqual([[0.64, 1.28]]);
    expect(clip.vStart).toBeCloseTo(0.48, 5);
    expect(clip.vEnd).toBeCloseTo(1.44, 5);
  });

  it('honors the configured minClipLength when merging short runs', () => {
    // At 1600 Hz a 40ms block is 64 samples = 0.04s; [1,1,0,1,1] gives runs
    // [0, 0.08] and [0.12, 0.2] separated by a 0.04s gap.
    const splitWith = (minClipLength: number) =>
      getInitClipData(buildData([1, 1, 0, 1, 1]), 1600, {
        ...opts,
        blockMs: 40,
        minClipLength,
      });
    // With a low threshold both runs are long enough to survive, so nothing
    // merges or needs a merge gap and minGap stays 0.
    const loose = splitWith(0.05);
    expect(loose.clips).toHaveLength(2);
    expect(bounds(loose.clips)).toEqual([
      [0, 0.08],
      [0.12, 0.2],
    ]);
    expect(loose.minGap).toBe(0);
    // With a higher threshold the short runs are merged into a single clip,
    // leaving no gaps to report.
    const tight = splitWith(0.2);
    expect(bounds(tight.clips)).toEqual([[0, 0.2]]);
    expect(tight.minGap).toBe(0);
  });
});

describe('expandClip', () => {
  it('expands clip bounds into neighboring silence by 25% of each gap', () => {
    const clip = {start: 0.6, end: 1.0, vStart: 0.6, vEnd: 1.0};

    expandClip(clip, 0.2, 1.8, 0.25, 2.0);

    expect(clip.vStart).toBeCloseTo(0.5, 5);
    expect(clip.vEnd).toBeCloseTo(1.2, 5);
  });

  it('leaves a clip unchanged when there is no surrounding silence to absorb', () => {
    const clip = {start: 0.5, end: 1.0, vStart: 0.5, vEnd: 1.0};

    expandClip(clip, 0.5, 1.0, 0.25, 2.0);

    expect(clip.vStart).toBe(0.5);
    expect(clip.vEnd).toBe(1.0);
  });

  it('expands by 25% of each gap even with very large surrounding silence', () => {
    const clip = {start: 1.0, end: 2.0, vStart: 1.0, vEnd: 2.0};

    expandClip(clip, 0.0, 100.0, 0.25, 100.0);

    expect(clip.vStart).toBeCloseTo(0.75, 5);
    expect(clip.vEnd).toBeCloseTo(26.5, 5);
  });
});

describe('findMinMergeGap', () => {
  it('returns an empty InitClipData for an empty input', () => {
    expect(findMinMergeGap([], [], 0.3)).toEqual({
      clips: [],
      gaps: [],
      minGap: 0,
    });
  });

  it('does not merge when every clip already meets minClipLength', () => {
    const clips = [mk(0, 1), mk(1.5, 2)];
    const result = findMinMergeGap(clips, getClipGaps(clips), 0.3);
    expect(result.minGap).toBe(0);
    expect(result.clips).toBe(clips);
    expect(bounds(clips)).toEqual([
      [0, 1],
      [1.5, 2],
    ]);
  });

  it('finds the smallest gap that makes every merged clip long enough', () => {
    // A (0, 1) --0.15-- B (1.15, 1.2) --0.02-- C (1.22, 1.23) --0.4-- D (1.63, 2)
    // Merging at 0.02 leaves B+C at only 0.08 (< 0.3); 0.15 is the first
    // threshold at which every group meets the minimum.
    const clips = [mk(0, 1), mk(1.15, 1.2), mk(1.22, 1.23), mk(1.63, 2)];
    const result = findMinMergeGap(clips, getClipGaps(clips), 0.3);
    expect(result.minGap).toBeCloseTo(0.15, 5);
    expect(result.clips).toBe(clips);
    expect(bounds(result.clips)).toEqual([
      [0, 1],
      [1.15, 1.2],
      [1.22, 1.23],
      [1.63, 2],
    ]);
  });

  it('prefers the smallest gap when it already satisfies the minimum', () => {
    // A (0, 1) --0.02-- B (1.02, 1.08) --0.04-- C (1.12, 2)
    // Merging A+B across 0.02 yields a 1.08s group, so 0.02 suffices.
    const clips = [mk(0, 1), mk(1.02, 1.08), mk(1.12, 2)];
    const result = findMinMergeGap(clips, getClipGaps(clips), 0.1);
    expect(result.minGap).toBeCloseTo(0.02, 5);
    expect(result.clips).toBe(clips);
  });

  it('keeps the raw clips when no single gap reaches the minimum', () => {
    // Even merging both clips cannot reach 0.3 worth of audio.
    const clips = [mk(0, 0.1), mk(0.3, 0.4)];
    const result = findMinMergeGap(clips, getClipGaps(clips), 0.5);
    expect(result.clips).toBe(clips);
    expect(result.minGap).toBe(0);
  });

  it('keeps the raw clips when there are no mergeable gaps', () => {
    // A single short clip has no gaps to merge across...
    const single = [mk(0, 0.2)];
    const singleResult = findMinMergeGap(single, [], 0.3);
    expect(singleResult.clips).toBe(single);
    expect(singleResult.minGap).toBe(0);
    // ...and so do several clips whose only gaps are at or below 0.01.
    const tinyGaps = [mk(0, 0.2), mk(0.21, 0.25)];
    const gapResult = findMinMergeGap(tinyGaps, getClipGaps(tinyGaps), 0.3);
    expect(gapResult.clips).toBe(tinyGaps);
    expect(gapResult.minGap).toBe(0);
  });
});

describe('mergeClipsByGap', () => {
  it('returns [] for an empty input', () => {
    expect(mergeClipsByGap([], 0.5)).toEqual([]);
  });

  it('returns a single clip unchanged with no children', () => {
    const clip = mk(0, 1);
    expect(mergeClipsByGap([clip], 0.5)).toEqual([clip]);
    expect(mergeClipsByGap([clip], 0.5)[0].children).toBeUndefined();
  });

  it('merges consecutive clips whose gap is within minGap into a parent', () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const [parent] = mergeClipsByGap([a, b], 0.5);
    expect(parent).toEqual({
      start: 0,
      end: 2,
      vStart: 0,
      vEnd: 2,
      children: [a, b],
    });
  });

  it('merges when the gap exactly equals minGap', () => {
    const a = mk(0, 1);
    const b = mk(1.5, 2);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([
      {start: 0, end: 2, vStart: 0, vEnd: 2, children: [a, b]},
    ]);
  });

  it('keeps clips separate when the gap exceeds minGap', () => {
    const a = mk(0, 1);
    const b = mk(10, 11);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([a, b]);
  });

  it('preserves the original clip references for unmerged clips', () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(10, 11);
    const result = mergeClipsByGap([a, b, c], 0.5);
    expect(result[0].children).toEqual([a, b]);
    expect(result[1]).toBe(c);
  });

  it('produces a single parent spanning everything when all gaps merge', () => {
    const clips = [mk(0, 1), mk(1.1, 2), mk(2.1, 3), mk(3.2, 4)];
    expect(bounds(mergeClipsByGap(clips, 1))).toEqual([[0, 4]]);
  });

  it('groups several merged runs separated by large gaps', () => {
    const a = mk(0, 1);
    const b = mk(1.1, 2);
    const c = mk(2.1, 3);
    const d = mk(4, 5);
    const e = mk(5.1, 6);
    const result = mergeClipsByGap([a, b, c, d, e], 0.15);
    expect(bounds(result)).toEqual([
      [0, 3],
      [4, 6],
    ]);
    expect(result[0].children).toEqual([a, b, c]);
    expect(result[1].children).toEqual([d, e]);
  });

  it('keeps vStart/vEnd of the parent as the outer span of its children', () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(2.4, 3.5);
    const [parent] = mergeClipsByGap([a, b, c], 0.5);
    expect(parent.vStart).toBe(0);
    expect(parent.vEnd).toBe(3.5);
  });
});

describe('mergeClipsByGapScoped', () => {
  // gaps: a-b 0.2, b-c 2.5, c-d 0.3
  const clips = [mk(0, 1), mk(1.2, 2), mk(4.5, 5), mk(5.3, 6)];

  it('merges only the focused clip run and leaves the rest alone', () => {
    // Focus spans a-b, so that pair is the run being regrouped.
    const focus = {start: 0, end: 2, vStart: 0, vEnd: 2};

    // c-d also sit within a 0.3 gap, but they are outside the focused run, so
    // they stay separate -- the opposite of a global merge at this gap, which
    // would join them too.
    expect(bounds(mergeClipsByGapScoped(clips, 3, focus))).toEqual([
      [0, 2],
      [4.5, 5],
      [5.3, 6],
    ]);

    // A gap too small to merge a-b leaves the list untouched.
    expect(bounds(mergeClipsByGapScoped(clips, 0.1, focus))).toEqual(
      bounds(clips),
    );
  });

  it('does not merge inside a focus that is a single raw clip', () => {
    // Focus b: its run holds one clip, so there is nothing to merge, even
    // though a global merge at this gap would join b and c across 2.5s.
    const result = mergeClipsByGapScoped(clips, 3, clips[1]);
    expect(bounds(result)).toEqual(bounds(clips));
    expect(result[1].children).toBeUndefined();
  });

  it('accepts a merged parent as focus', () => {
    const [parent] = mergeClipsByGap([clips[0], clips[1]], 0.5);
    expect(bounds(mergeClipsByGapScoped(clips, 0.1, parent))).toEqual([
      [0, 1],
      [1.2, 2],
      [4.5, 5],
      [5.3, 6],
    ]);
  });

  it('returns the clips unchanged for a single-clip or unknown focus', () => {
    expect(mergeClipsByGapScoped([mk(0, 1)], 0.5, mk(0, 1))).toEqual([
      mk(0, 1),
    ]);
    expect(mergeClipsByGapScoped(clips, 0.5, mk(50, 60))).toEqual(clips);
  });
});

describe('getClipGaps', () => {
  it('returns [] for a single clip', () => {
    expect(getClipGaps([mk(0, 1)])).toEqual([]);
  });

  it('returns distinct positive gaps above 0.01, ascending', () => {
    // gaps: 0.5, 0.5, 3 -> deduped and sorted
    const clips = [mk(0, 1), mk(1.5, 2), mk(2.5, 3), mk(6, 7)];
    expect(getClipGaps(clips)).toEqual([0.5, 3]);
  });

  it('skips gaps of 0.01 or less but keeps larger ones', () => {
    // first gap is 0.005 (skipped), second gap is 1 (kept)
    const clips = [mk(0, 1), mk(1.005, 2), mk(3, 4)];
    expect(getClipGaps(clips)).toEqual([1]);
  });
});
