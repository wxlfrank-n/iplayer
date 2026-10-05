import {describe, expect, it} from 'vitest';
import {mergeClipsByGap, type Clip} from './clips';
import {mergeClips, splitClip} from './swipe';

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

describe('splitClip', () => {
  it('returns null for clips without children', () => {
    const clips = [mk(0, 1)];
    expect(splitClip(clips, clips, 0)).toBeNull();
  });

  it('splits any group with at least two children by its largest gap', () => {
    const clip: Clip = {
      start: 0,
      end: 3,
      vStart: 0,
      vEnd: 3,
      children: [mk(0, 0.5), mk(0.8, 1.3), mk(2, 2.5)],
    };
    // largest child gap (0.7) sets the merge level just below itself
    const result = splitClip([clip], [clip], 0);
    expect(result?.mergeGap).toBeCloseTo(0.699999);
    expect(result?.activeClip).toBe(0);
  });

  it('sets the merge gap just below the largest child gap', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.6);

    const result = splitClip(clips, displayClips, 0);

    expect(result?.mergeGap).toBeCloseTo(0.499999);
    expect(result?.activeClip).toBe(0);
    expect(mergeClipsByGap(clips, result!.mergeGap)[0].children).toEqual([
      clips[0],
      clips[1],
    ]);
  });

  it('returns null when splitting an unmerged clip', () => {
    const clips = [mk(0, 1), mk(2, 3)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(splitClip(clips, displayClips, 0)).toBeNull();
  });

  it('keeps activeClip on the split group when earlier groups also break up', () => {
    /*
     * At mergeGap 0.2 the display list is:
     *   0: {c0,c1,c2}   1: {c3}   2: {c4}   3: {c5,c6}
     *
     * Splitting group 3 drops the gap just below its 0.1s child gap, which
     * also breaks group 0 apart. Every later group shifts right, so the
     * first piece of the split group ends up at index 5 -- not the old
     * index 3.
     */
    const clips = [
      mk(0, 1),
      mk(1.1, 2),
      mk(2.15, 3),
      mk(3.3, 4),
      mk(6, 7),
      mk(7.5, 8.5),
      mk(8.6, 9.6),
    ];
    const displayClips = mergeClipsByGap(clips, 0.2);
    const splitIdx = 3;

    expect(displayClips).toHaveLength(4);
    expect(displayClips[splitIdx].children).toEqual([clips[5], clips[6]]);

    const result = splitClip(clips, displayClips, splitIdx);

    expect(result?.mergeGap).toBeCloseTo(0.099999, 6);

    const nextClips = mergeClipsByGap(clips, result!.mergeGap);

    // The boundary gap is no longer merged, so all seven clips stand alone.
    expect(nextClips).toHaveLength(7);

    // activeClip must follow the first piece of the group that was split:
    // the first clip starting at or after the pre-split clip's start.
    expect(result!.activeClip).toBe(5);
    expect(nextClips[result!.activeClip].start).toBe(
      displayClips[splitIdx].start,
    );
    expect(nextClips[result!.activeClip]).toBe(clips[5]);

    /*
     * The active clip is strictly shorter than the group it came from, so
     * playback must read its bounds from the new list -- reusing the
     * pre-split clip would replay past the split point.
     */
    expect(nextClips[result!.activeClip].vEnd).toBeCloseTo(8.5, 6);
    expect(displayClips[splitIdx].vEnd).toBeCloseTo(9.6, 6);
  });
});

describe('mergeClips', () => {
  it('merges only the clip and tracks its nearest silence', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1); // all four separate

    const result = mergeClips(clips, displayClips, 1);

    // nearest gap for idx 1 is the previous (0.2 vs 0.5)
    expect(result?.clips).toHaveLength(3);
    expect(result?.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result?.clips[2]).toEqual(clips[3]);
    expect(result?.activeClip).toBe(0);
    expect(result?.mergeGap).toBeCloseTo(0.2);
    expect(result?.clips[0].start).toBe(0);
    expect(result?.clips[0].end).toBe(2);
  });

  it('merges toward the nearest neighbor when the next gap is smaller', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const result = mergeClips(clips, displayClips, 0);

    expect(result?.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result?.activeClip).toBe(0);
    expect(result?.mergeGap).toBeCloseTo(0.2);
  });

  it('merges an already-merged group with its nearest group', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const first = mergeClips(clips, displayClips, 1)!;
    const second = mergeClips(clips, first.clips, first.activeClip)!;

    expect(second.clips).toHaveLength(2);
    expect(second.clips[0].children).toEqual([clips[0], clips[1], clips[2]]);
    expect(second.activeClip).toBe(0);
    expect(second.mergeGap).toBeCloseTo(0.5);
  });

  it('returns null when merging the only displayed clip', () => {
    const clips = [mk(0, 1)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(mergeClips(clips, displayClips, 0)).toBeNull();
  });
});
