/**
 * Renders detected audio clips (silence-split segments) on the waveform as an
 * overlay layer exactly matching the canvas bars' window. Each visible clip is
 * a highlighted rectangle the user can click to select or play, rendered by
 * the standalone `Clip` component.
 */

import { memo, type ReactNode } from "react";
import type { Clip as ClipData } from "../utils/clips";
import type { WaveWindow } from "../types";
import { Clip } from "./Clip";

interface ClipsProps {
  clips: ClipData[];
  window: WaveWindow;
  onPlayRange: (start: number, end: number, repetitions: number) => void;
  repetitions: number;
  playing: boolean;
  onStopPlayback?: () => void;
  activeClip: number;
  onActivate: (idx: number) => void;
  onSwipe?: (idx: number, direction: "up" | "down") => void;
  /** Maps a clip's position in `clips` to the global clip index it reports
   *  (default: the array position). Lets a row render only its own clips while
   *  still reporting real indices for activation/swiping. */
  getIdx?: (c: ClipData, indexInArray: number) => number;
  /** Renders the per-clip label element nested inside each clip `<div>`. */
  renderLabel?: (id: number, c: ClipData, indexInArray: number) => ReactNode;
}

export const Clips = memo(function Clips({
  clips,
  window,
  onPlayRange,
  repetitions,
  playing,
  onStopPlayback,
  activeClip,
  onActivate,
  onSwipe,
  getIdx,
  renderLabel,
}: ClipsProps) {
  const { windowStartSec, windowLen } = window;

  return (
    <>
      {clips.map((c, idx) => {
        if (c.vEnd <= windowStartSec || c.vStart >= windowStartSec + windowLen) {
          return null;
        }
        const id = getIdx ? getIdx(c, idx) : idx;
        return (
          <Clip
            key={id}
            clip={c}
            window={window}
            id={id}
            active={id === activeClip}
            label={renderLabel?.(id, c, idx)}
            onPlayRange={onPlayRange}
            repetitions={repetitions}
            playing={playing}
            onStopPlayback={onStopPlayback}
            onActivate={onActivate}
            onSwipe={onSwipe}
          />
        );
      })}
    </>
  );
});