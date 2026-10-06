// @vitest-environment jsdom

import {describe, expect, it} from 'vitest';
import {clipLabelProps} from './ClipLabel';
import type {Clip as InitClipData} from '../utils/clips';

const mk = (start: number, end: number): InitClipData => ({
  start,
  end,
  vStart: start,
  vEnd: end,
});

const props = (clip: InitClipData, overrides: Record<string, unknown> = {}) =>
  clipLabelProps({
    id: 0,
    clip,
    activeClip: 0,
    clipCount: 1,
    playing: false,
    ...overrides,
  } as never);

describe('clipLabelProps canSplit', () => {
  it('does not offer a split for an unmerged clip', () => {
    expect(props(mk(0, 1)).canSplit).toBe(false);
  });

  it('offers a split for a merged group with a valid boundary', () => {
    const clip: InitClipData = {
      start: 0,
      end: 4,
      vStart: 0,
      vEnd: 4,
      children: [mk(0, 1), mk(2, 3)],
    };
    expect(props(clip).canSplit).toBe(true);
  });

  it('hides the split when no gap is a valid boundary', () => {
    // The only gap strands the 0.05s leading piece, so there is no boundary.
    const clip: InitClipData = {
      start: 0,
      end: 3,
      vStart: 0,
      vEnd: 3,
      children: [mk(0, 0.05), mk(2, 3)],
    };
    expect(props(clip).canSplit).toBe(false);
  });

  it('keeps the split when a sub-minimum piece has a long side', () => {
    // The 0.01s middle clip leaves a 1.06s accumulated piece behind it, so
    // the largest gap still qualifies.
    const clip: InitClipData = {
      start: 0,
      end: 5.5,
      vStart: 0,
      vEnd: 5.5,
      children: [mk(0, 1), mk(1.05, 1.06), mk(5, 5.5)],
    };
    expect(props(clip).canSplit).toBe(true);
  });

  it('does not split an expanded detector-produced clip', () => {
    const clip: InitClipData = {
      start: 0,
      end: 4,
      vStart: 0,
      vEnd: 4,
      expanded: true,
      children: [mk(0, 1), mk(1.5, 2), mk(3, 4)],
    };
    expect(props(clip).canSplit).toBe(false);
  });
});
