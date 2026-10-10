/**
 * Clip label rendered inside the clip's <div>, hanging just below the clip
 * band: an index badge plus its duration.
 *
 * Splitting and merging are performed with the clip swipe gestures only
 * (swipe up = split, swipe down = merge). The label carries no action buttons,
 * so a tap on it can never edit a clip by accident.
 */

import {memo} from 'react';
import type {Clip} from '../utils/clips';
import './ClipLabel.css';

export interface ClipLabelProps {
  index: number;
  duration: number;
  active: boolean;
}

interface ClipLabelState {
  /** Display index of the clip the label belongs to. */
  id: number;
  clip: Clip;
  /** Currently active clip index, used to highlight the label. */
  activeClip: number;
}

/**
 * Props for a `ClipLabel`, derived from the clip it describes.
 *
 * Both waveform views label their clips the same way and differ only in the
 * element they wrap the label in.
 */
export function clipLabelProps({
  id,
  clip,
  activeClip,
}: ClipLabelState): ClipLabelProps {
  return {
    index: id,
    duration: clip.vEnd - clip.vStart,
    active: id === activeClip,
  };
}

export const ClipLabel = memo(({index, duration, active}: ClipLabelProps) => {
  return (
    <span
      className={`stacked-clip-label ${
        active ? 'stacked-clip-label--active' : ''
      }`}
    >
      {index + 1}

      <span className="stacked-clip-dur">{duration.toFixed(1)}s</span>
    </span>
  );
});
