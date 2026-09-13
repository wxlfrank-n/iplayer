/**
 * Playback control buttons row.
 *
 * Controls:
 * - Skip backward (configurable seconds, default 10s)
 * - Previous track
 * - Play/Pause toggle (main control)
 * - Next track
 * - Skip forward (configurable seconds, default 10s)
 *
 * All buttons are disabled when no track is loaded.
 * The play button shows loading state while audio is being decoded.
 */

import { memo } from "react";
import { useAppSelector } from "../store/hooks";
import {
  selectIsPlaying,
  selectCanPlay,
  selectSkipSeconds,
} from "../store/selectors";
import SkipBackIcon from "../assets/icons/skip-back.svg?react";
import SkipForwardIcon from "../assets/icons/skip-forward.svg?react";
import PrevIcon from "../assets/icons/prev.svg?react";
import NextIcon from "../assets/icons/next.svg?react";
import PlayIcon from "../assets/icons/play.svg?react";
import PauseIcon from "../assets/icons/pause.svg?react";

interface PlayerControlsProps {
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  onSkipForward: () => void;
  onSkipBackward: () => void;
}

export const PlayerControls = memo(function PlayerControls({
  onTogglePlay,
  onNext,
  onPrev,
  onSkipForward,
  onSkipBackward,
}: PlayerControlsProps) {
  const isPlaying = useAppSelector(selectIsPlaying);
  const hasTrack = useAppSelector(selectCanPlay);
  const skipSeconds = useAppSelector(selectSkipSeconds);
  return (
    <div className="player-controls">
      <button
        className="control-btn control-btn--skip"
        onClick={onSkipBackward}
        disabled={!hasTrack}
        title={`Back ${skipSeconds}s`}
      >
        <SkipBackIcon width={36} height={36} />
        <span className="control-btn__label">{skipSeconds}</span>
      </button>
      <button
        className="control-btn"
        onClick={onPrev}
        disabled={!hasTrack}
        title="Previous"
      >
        <PrevIcon width={20} height={20} />
      </button>
      <button
        className={`control-btn control-btn--play ${isPlaying ? "control-btn--playing" : "control-btn--paused"}`}
        onClick={onTogglePlay}
        disabled={!hasTrack}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
      </button>
      <button
        className="control-btn"
        onClick={onNext}
        disabled={!hasTrack}
        title="Next"
      >
        <NextIcon width={20} height={20} />
      </button>
      <button
        className="control-btn control-btn--skip"
        onClick={onSkipForward}
        disabled={!hasTrack}
        title={`Forward ${skipSeconds}s`}
      >
        <SkipForwardIcon width={36} height={36} />
        <span className="control-btn__label">{skipSeconds}</span>
      </button>
    </div>
  );
});
