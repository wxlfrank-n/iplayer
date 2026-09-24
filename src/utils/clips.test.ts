import { describe, expect, it } from "vitest";
import {
  clipGaps,
  expandClip,
  mergeClipsByGap,
  mergeShortClips,
  splitBySilence,
  type Clip,
} from "./clips";

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

const bounds = (clips: Clip[]) => clips.map((c) => [c.start, c.end]);

describe("splitBySilence", () => {
  const opts = {
      blockMs: 640,
      silenceRatio: 0.01,
      minSilenceLength: 0.05,
      minClipLength: 0.3,
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

  it("returns an empty list when there is no data or a non-positive sample rate", () => {
    expect(splitBySilence(null, 44100, opts)).toEqual([]);
    expect(splitBySilence(new Float32Array(0), 44100, opts)).toEqual([]);
    expect(splitBySilence(buildData([1, 1]), 0, opts)).toEqual([]);
  });

  it("detects a continuous run of sound as a single clip spanning the buffer", () => {
    const [clip] = splitBySilence(buildData([1, 1, 1]), 100, opts);
    expect(clip.start).toBe(0);
    expect(clip.end).toBeCloseTo(1.92, 5);
    expect(clip.vStart).toBe(0);
    expect(clip.vEnd).toBeCloseTo(1.92, 5);
  });

  it("splits around a silent block and expands vStart/vEnd into the gap", () => {
    const clips = splitBySilence(buildData([1, 0, 1, 1]), 100, opts);
    expect(clips).toHaveLength(2);
    expect(bounds(clips)).toEqual([
      [0, 0.64],
      [1.28, 2.56],
    ]);
    // First clip expands into the following silence.
    expect(clips[0].vStart).toBe(0);
    expect(clips[0].vEnd).toBeCloseTo(0.704, 5);
    // Second clip expands into the preceding silence.
    expect(clips[1].vStart).toBeCloseTo(1.152, 5);
    expect(clips[1].vEnd).toBeCloseTo(2.56, 5);
  });

  it("trims leading and trailing silence and expands into it by 25% of each gap", () => {
    const [clip] = splitBySilence(buildData([0, 1, 0]), 100, opts);
    expect(bounds([clip])).toEqual([[0.64, 1.28]]);
    expect(clip.vStart).toBeCloseTo(0.576, 5);
    expect(clip.vEnd).toBeCloseTo(1.344, 5);
  });

  it("honors the configured minClipLength when folding short runs", () => {
    // At 1600 Hz a 40ms block is 64 samples = 0.04s; [1,1,0,1,1] gives runs
    // [0, 0.08] and [0.12, 0.2] separated by a 0.04s gap (within
    // minSilenceLength 0.05).
    const splitWith = (minClipLength: number) =>
      splitBySilence(buildData([1, 1, 0, 1, 1]), 1600, {
        ...opts,
        blockMs: 40,
        minClipLength,
      });
    // With a low threshold both runs are long enough to survive.
    expect(splitWith(0.05)).toHaveLength(2);
    // With a higher threshold the short runs fold together.
    expect(bounds(splitWith(0.2))).toEqual([[0, 0.2]]);
  });
});

describe("expandClip", () => {
  it("expands clip bounds into neighboring silence without exceeding 10% of the clip length", () => {
    const clip = { start: 0.6, end: 1.0, vStart: 0.6, vEnd: 1.0 };

    expandClip(clip, 0.2, 1.8, 0.25, 2.0);

    expect(clip.vStart).toBeCloseTo(0.56, 5);
    expect(clip.vEnd).toBeCloseTo(1.04, 5);
  });

  it("leaves a clip unchanged when there is no surrounding silence to absorb", () => {
    const clip = { start: 0.5, end: 1.0, vStart: 0.5, vEnd: 1.0 };

    expandClip(clip, 0.5, 1.0, 0.25, 2.0);

    expect(clip.vStart).toBe(0.5);
    expect(clip.vEnd).toBe(1.0);
  });

  it("caps expansion at 10% of the clip length even with very large surrounding gaps", () => {
    const clip = { start: 1.0, end: 2.0, vStart: 1.0, vEnd: 2.0 };

    expandClip(clip, 0.0, 100.0, 0.25, 100.0);

    expect(clip.vStart).toBeCloseTo(0.9, 5);
    expect(clip.vEnd).toBeCloseTo(2.1, 5);
  });
});

describe("mergeShortClips", () => {
  it("returns an empty array untouched", () => {
    expect(mergeShortClips([])).toEqual([]);
  });

  it("keeps a single clip unchanged", () => {
    const clip = mk(0, 1);
    expect(mergeShortClips([clip])).toEqual([clip]);
  });

  it("keeps clips that are already long enough", () => {
    const clips = [mk(0, 1), mk(1.5, 2)];
    expect(bounds(mergeShortClips(clips))).toEqual([
      [0, 1],
      [1.5, 2],
    ]);
  });

  it("keeps a short clip when its length exactly equals the threshold", () => {
    const clips = [mk(0, 0.3), mk(0.35, 1)];
    expect(bounds(mergeShortClips(clips))).toEqual([
      [0, 0.3],
      [0.35, 1],
    ]);
  });

  it("merges a short clip even when both gaps are large", () => {
    const clips = [mk(0, 1), mk(1.3, 1.4), mk(2, 3)];
    expect(bounds(mergeShortClips(clips))).toEqual([
      [0, 1.4],
      [2, 3],
    ]);
  });

  it("merges a short clip into its left neighbor when left silence <= right silence", () => {
    // A (0, 1) --0.02-- B (1.02, 1.08) --0.04-- C (1.12, 2)
    const a = mk(0, 1);
    const b = mk(1.02, 1.08);
    const c = mk(1.12, 2);
    const result = mergeShortClips([a, b, c]);
    expect(bounds(result)).toEqual([
      [0, 1.08],
      [1.12, 2],
    ]);
    expect(a.vEnd).toBe(1.08);
  });

  it("merges a short clip into its right neighbor when right silence is smaller", () => {
    // A (0, 1) --0.05-- B (1.05, 1.11) --0.02-- C (1.13, 2)
    const a = mk(0, 1);
    const b = mk(1.05, 1.11);
    const c = mk(1.13, 2);
    const result = mergeShortClips([a, b, c]);
    expect(bounds(result)).toEqual([
      [0, 1],
      [1.05, 2],
    ]);
    expect(c.vStart).toBe(1.05);
  });

  it("keeps merging until the resulting clip is long enough", () => {
    // B (0, 0.06) --0.02-- C (0.08, 0.1) --0.02-- D (0.12, 1)
    const b = mk(0, 0.06);
    const c = mk(0.08, 0.1);
    const d = mk(0.12, 1);
    const result = mergeShortClips([b, c, d]);
    expect(bounds(result)).toEqual([[0, 1]]);
    expect(d.vStart).toBe(0);
  });

  it("honors a custom minClipLength", () => {
    // 0.34s is already long enough under the default minClipLength, so
    // nothing merges...
    expect(bounds(mergeShortClips([mk(0, 1), mk(1.06, 1.4)]))).toEqual([
      [0, 1],
      [1.06, 1.4],
    ]);
    // ...but a stricter minClipLength makes the same pair merge.
    expect(
      bounds(mergeShortClips([mk(0, 1), mk(1.06, 1.4)], { minClipLength: 0.5 })),
    ).toEqual([[0, 1.4]]);
  });
});

describe("mergeClipsByGap", () => {
  it("returns [] for an empty input", () => {
    expect(mergeClipsByGap([], 0.5)).toEqual([]);
  });

  it("returns a single clip unchanged with no children", () => {
    const clip = mk(0, 1);
    expect(mergeClipsByGap([clip], 0.5)).toEqual([clip]);
    expect(mergeClipsByGap([clip], 0.5)[0].children).toBeUndefined();
  });

  it("merges consecutive clips whose gap is within minGap into a parent", () => {
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

  it("merges when the gap exactly equals minGap", () => {
    const a = mk(0, 1);
    const b = mk(1.5, 2);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([
      { start: 0, end: 2, vStart: 0, vEnd: 2, children: [a, b] },
    ]);
  });

  it("keeps clips separate when the gap exceeds minGap", () => {
    const a = mk(0, 1);
    const b = mk(10, 11);
    expect(mergeClipsByGap([a, b], 0.5)).toEqual([a, b]);
  });

  it("preserves the original clip references for unmerged clips", () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(10, 11);
    const result = mergeClipsByGap([a, b, c], 0.5);
    expect(result[0].children).toEqual([a, b]);
    expect(result[1]).toBe(c);
  });

  it("produces a single parent spanning everything when all gaps merge", () => {
    const clips = [mk(0, 1), mk(1.1, 2), mk(2.1, 3), mk(3.2, 4)];
    expect(bounds(mergeClipsByGap(clips, 1))).toEqual([[0, 4]]);
  });

  it("groups several merged runs separated by large gaps", () => {
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

  it("keeps vStart/vEnd of the parent as the outer span of its children", () => {
    const a = mk(0, 1);
    const b = mk(1.2, 2);
    const c = mk(2.4, 3.5);
    const [parent] = mergeClipsByGap([a, b, c], 0.5);
    expect(parent.vStart).toBe(0);
    expect(parent.vEnd).toBe(3.5);
  });
});

describe("clipGaps", () => {
  it("seeds with the configured minimum silence length", () => {
    expect(clipGaps([mk(0, 1), mk(1.5, 2)], 0.05)).toEqual([0.05, 0.5]);
  });

  it("returns only distinct positive gaps above 0.01", () => {
    // gaps: 0.5, 0.5, 3
    const clips = [mk(0, 1), mk(1.5, 2), mk(2.5, 3), mk(6, 7)];
    expect(clipGaps(clips, 0.05)).toEqual([0.05, 0.5, 3]);
  });

  it("returns just the seed for a single clip", () => {
    expect(clipGaps([mk(0, 1)], 0.05)).toEqual([0.05]);
  });

  it("skips gaps of 0.01 or less", () => {
    expect(clipGaps([mk(0, 1), mk(1.005, 2)], 0.05)).toEqual([0.05]);
  });
});