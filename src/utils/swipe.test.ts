import {describe, expect, it} from 'vitest';
import {mergeClipsByGap, type Clip} from './clips';
import {mergeClips, splitClip} from './swipe';

const mk = (start: number, end: number): Clip => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

const bounds = (clips: Clip[]) => clips.map(c => [c.start, c.end]);

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
    const result = splitClip([clip], [clip], 0, 'global');
    expect(result?.mergeGap).toBeCloseTo(0.699999);
    expect(result?.activeClip).toBe(0);
  });

  it('sets the merge gap just below the largest child gap', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.6);

    const result = splitClip(clips, displayClips, 0, 'global');

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

    const result = splitClip(clips, displayClips, splitIdx, 'global');

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

  it('cuts at one boundary only, leaving earlier groups alone', () => {
    /*
     * Three raw clips merged into one group by 1s gaps. All three gaps are
     * equal, so the largest one is the first: a-b | c-d. Clip scope performs
     * that single cut rather than re-thresholding the group, which would have
     * broken up every 1s boundary at once.
     */
    const clips = [mk(0, 1), mk(2, 3), mk(4, 5)];
    const displayClips = mergeClipsByGap(clips, 1);
    expect(displayClips).toHaveLength(1);

    const result = splitClip(clips, displayClips, 0, 'clip')!;

    expect(bounds(result.clips!)).toEqual([
      [0, 1],
      [2, 5],
    ]);
    expect(result.clips![1].children).toEqual([clips[1], clips[2]]);
    expect(result.activeClip).toBe(0);
  });

  it('keeps unrelated groups intact when splitting in clip scope', () => {
    /*
     * Regression: the scoped split used to regroup from the raw detection
     * result, which reverted grouping the user had already established
     * elsewhere on the track. Splitting the c-d group must leave the a-b and
     * e-f groups merged.
     */
    const clips = [
      mk(0, 1),
      mk(1.15, 2),
      mk(6, 7),
      mk(7.15, 8),
      mk(12, 13),
      mk(13.15, 14),
    ];
    // a-b, c-d and e-f are 0.15 apart (inside the 0.2 threshold) while ~4.85
    // silences keep the three pairs apart.
    const displayClips = mergeClipsByGap(clips, 0.2);
    expect(bounds(displayClips)).toEqual([
      [0, 2],
      [6, 8],
      [12, 14],
    ]);

    const result = splitClip(clips, displayClips, 1, 'clip')!;

    // c-d splits back apart; a-b and e-f stay merged.
    expect(bounds(result.clips!)).toEqual([
      [0, 2],
      [6, 7],
      [7.15, 8],
      [12, 14],
    ]);
    expect(result.clips![0].children).toEqual([clips[0], clips[1]]);
    expect(result.clips![3].children).toEqual([clips[4], clips[5]]);
    expect(result.activeClip).toBe(1);
  });
});

describe('mergeClips', () => {
  it('merges only the clip and tracks its nearest silence', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1); // all four separate

    const result = mergeClips(clips, displayClips, 1, 'global');

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

    const result = mergeClips(clips, displayClips, 0, 'global');

    expect(result?.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result?.activeClip).toBe(0);
    expect(result?.mergeGap).toBeCloseTo(0.2);
  });

  it('merges an already-merged group with its nearest group', () => {
    const clips = [mk(0, 1), mk(1.2, 2), mk(2.5, 3), mk(5, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const first = mergeClips(clips, displayClips, 1, 'global')!;
    const second = mergeClips(clips, first.clips, first.activeClip, 'global')!;

    expect(second.clips).toHaveLength(2);
    expect(second.clips[0].children).toEqual([clips[0], clips[1], clips[2]]);
    expect(second.activeClip).toBe(0);
    expect(second.mergeGap).toBeCloseTo(0.5);
  });

  it('leaves other groups untouched in clip scope', () => {
    // a-b gap 0.2, b-c gap 2, c-d gap 0.3.
    const clips = [mk(0, 1), mk(1.2, 2), mk(4, 5), mk(5.3, 6)];
    const displayClips = mergeClipsByGap(clips, 0.1); // all four separate

    // Gesture on c: nearest neighbor is d (0.3 vs 2 to b), so the gap is 0.3.
    // Global scope at 0.3 also swallows a-b (0.2), which is outside the gesture.
    const global = mergeClips(clips, displayClips, 2, 'global');
    expect(bounds(global!.clips)).toEqual([
      [0, 2],
      [4, 6],
    ]);

    // Clip scope merges only c-d and leaves a-b alone.
    const scoped = mergeClips(clips, displayClips, 2, 'clip');
    expect(bounds(scoped!.clips)).toEqual([
      [0, 1],
      [1.2, 2],
      [4, 6],
    ]);
    expect(scoped!.activeClip).toBe(2);
    expect(scoped!.mergeGap).toBeCloseTo(0.3);
  });

  it('keeps grouping established elsewhere when merging in clip scope', () => {
    /*
     * Regression: scoped operations used to regroup from the raw detection
     * result, which reverted grouping established by an earlier clip-scope
     * gesture on a different part of the track.
     */
    const clips = [mk(0, 1), mk(1.2, 2), mk(4, 5), mk(5.3, 6), mk(8, 9)];
    const separate = mergeClipsByGap(clips, 0.1);

    // First clip-scope merge: a-b (0.2 gap).
    const first = mergeClips(clips, separate, 1, 'clip')!;
    expect(bounds(first.clips)).toEqual([
      [0, 2],
      [4, 5],
      [5.3, 6],
      [8, 9],
    ]);

    // Second clip-scope merge on c-d must leave the a-b group intact.
    const second = mergeClips(clips, first.clips, 2, 'clip')!;
    expect(bounds(second.clips)).toEqual([
      [0, 2],
      [4, 6],
      [8, 9],
    ]);
    expect(second.clips[0].children).toEqual([clips[0], clips[1]]);
  });

  it('merges exactly one pair regardless of the merge gap', () => {
    /*
     * The three gaps are 0.4 / 0.6 / 0.5. Clip scope picks the nearest pair
     * (0.4) and merges only those two, so exactly one boundary disappears and
     * the third gap plays no part.
     */
    const clips = [mk(0, 1), mk(1.4, 2), mk(2.6, 3), mk(4.1, 5)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    const result = mergeClips(clips, displayClips, 1, 'clip')!;

    expect(bounds(result.clips)).toEqual([
      [0, 2],
      [2.6, 3],
      [4.1, 5],
    ]);
    expect(result.clips[0].children).toEqual([clips[0], clips[1]]);
    expect(result.activeClip).toBe(0);
  });

  it('returns null when merging the only displayed clip', () => {
    const clips = [mk(0, 1)];
    const displayClips = mergeClipsByGap(clips, 0.1);

    expect(mergeClips(clips, displayClips, 0)).toBeNull();
  });
});
