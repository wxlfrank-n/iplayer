/**
 * Clip label rendered inside the clip's <div>, hanging just below the clip
 * band: an index badge plus its duration.
 *
 * On the active clip, contextual action buttons are shown:
 *
 *   ✂  Split
 *   🔗 Merge
 *
 * The buttons also communicate the equivalent swipe gestures:
 * swipe up = split, swipe down = merge.
 */

import {memo} from 'react';
import {useT} from '../i18n';
import {
  MIN_SPLIT_PIECE_SEC,
  splitClipAtLargestGap,
  type Clip,
} from '../utils/clips';
import type {SwipeDirection} from '../types';
import './ClipLabel.css';

export interface ClipLabelProps {
  index: number;
  duration: number;
  active: boolean;
  canSplit: boolean;
  canMerge: boolean;
  onSplit?: () => void;
  onMerge?: () => void;
}

interface ClipLabelState {
  /** Display index of the clip the label belongs to. */
  id: number;
  clip: Clip;
  /** Currently active clip index, used to highlight the label. */
  activeClip: number;
  /** Total number of displayed clips, used to detect a lone clip. */
  clipCount: number;
  playing: boolean;
  /** Smallest piece a split may leave alone (defaults to MIN_SPLIT_PIECE_SEC). */
  minPieceSec?: number;
  /** Swipe handler; absent (or undefined) disables the split/merge actions. */
  onSwipeClip?: (idx: number, direction: SwipeDirection) => void;
}

/**
 * Props for a `ClipLabel`, derived from the clip it describes.
 *
 * Both waveform views label their clips the same way and differ only in the
 * element they wrap the label in, so the split/merge availability rules live
 * here instead of being restated per view.
 */
export function clipLabelProps({
  id,
  clip,
  activeClip,
  clipCount,
  playing,
  minPieceSec = MIN_SPLIT_PIECE_SEC,
  onSwipeClip,
}: ClipLabelState): ClipLabelProps {
  return {
    index: id,
    duration: clip.vEnd - clip.vStart,
    active: id === activeClip,

    /*
     * Only a merged group can be split back apart. `expanded` marks a clip the
     * detector already produced, which is never a user-made merge. Both merge
     * scopes honor the same min-piece rule, so the group must have a boundary
     * that leaves neither side shorter than the configured minimum.
     */
    canSplit:
      !playing &&
      clip.expanded !== true &&
      splitClipAtLargestGap(clip, minPieceSec) !== null,

    /* The outermost clip has no neighbor in one direction. */
    canMerge: !playing && (id > 0 || id < clipCount - 1),
    onSplit: onSwipeClip ? () => onSwipeClip(id, 'up') : undefined,
    onMerge: onSwipeClip ? () => onSwipeClip(id, 'down') : undefined,
  };
}

export const ClipLabel = memo(
  ({
    index,
    duration,
    active,
    canSplit,
    canMerge,
    onSplit,
    onMerge,
  }: ClipLabelProps) => {
    const t = useT();
    return (
      <span
        className={`stacked-clip-label ${
          active ? 'stacked-clip-label--active' : ''
        }`}
      >
        {index + 1}

        <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>

        {active && canSplit && onSplit && (
          <button
            type="button"
            className="stacked-clip-action stacked-clip-action--split"
            title={t('clipLabel.split')}
            aria-label={t('clipLabel.split')}
            onClick={e => {
              e.stopPropagation();
              onSplit();
            }}
          >
            <span className="split-icon">✂️</span>
          </button>
        )}

        {active && canMerge && onMerge && (
          <button
            type="button"
            className="stacked-clip-action stacked-clip-action--merge"
            title={t('clipLabel.merge')}
            aria-label={t('clipLabel.merge')}
            onClick={e => {
              e.stopPropagation();
              onMerge();
            }}
          >
            <span className="merge-icon">🔗</span>
          </button>
        )}
      </span>
    );
  },
);
