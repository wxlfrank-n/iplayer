/**
 * Playback control buttons row.
 *
 * Controls:
 * - Skip backward (configurable seconds, default 10s)
 * - Back to start
 * - Play/Pause toggle (main control)
 * - Skip to end
 * - Skip forward (configurable seconds, default 10s)
 *
 * All buttons are disabled when no track is loaded.
 * The play button shows loading state while audio is being decoded.
 */

import { memo } from "react";
import { useAppSelector } from "../store/hooks";
import { useT } from "../i18n";
import {
  selectIsPlaying,
  selectCanPlay,
  selectSkipSeconds,
  selectCurrentTime,
  selectDuration,
} from "../store/selectors";
import SkipBackIcon from "../assets/icons/skip-back.svg?react";
import SkipForwardIcon from "../assets/icons/skip-forward.svg?react";
import PrevIcon from "../assets/icons/prev.svg?react";
import NextIcon from "../assets/icons/next.svg?react";
import PlayIcon from "../assets/icons/play.svg?react";
import PauseIcon from "../assets/icons/pause.svg?react";
import "./PlayerControls.css";

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
  const currentTime = useAppSelector(selectCurrentTime);
  const duration = useAppSelector(selectDuration);
  const t = useT();
  const atStart = currentTime <= 0;
  const atEnd = duration > 0 && currentTime >= duration;
  return (
    <div className="player-controls">
      <button
        className="control-btn control-btn--skip"
        onClick={onSkipBackward}
        disabled={!hasTrack || atStart}
        aria-label={t("player.backSeconds", { seconds: skipSeconds })}
        title={t("player.backSecondsShort", { seconds: skipSeconds })}
      >
        <SkipBackIcon width={36} height={36} />
        <span className="control-btn__label" aria-hidden="true">
          {skipSeconds}
        </span>
      </button>
      <button
        className="control-btn"
        onClick={onPrev}
        disabled={!hasTrack}
        aria-label={t("player.backToStart")}
        title={t("player.backToStart")}
      >
        <PrevIcon width={20} height={20} />
      </button>
      <button
        className={`control-btn control-btn--play ${isPlaying ? "control-btn--playing" : "control-btn--paused"}`}
        onClick={onTogglePlay}
        disabled={!hasTrack}
        aria-label={isPlaying ? t("player.pause") : t("player.play")}
        title={isPlaying ? t("player.pause") : t("player.play")}
      >
        {isPlaying ? <PauseIcon width={22} height={22} /> : <PlayIcon width={22} height={22} />}
      </button>
      <button
        className="control-btn"
        onClick={onNext}
        disabled={!hasTrack}
        aria-label={t("player.skipToEnd")}
        title={t("player.skipToEnd")}
      >
        <NextIcon width={20} height={20} />
      </button>
      <button
        className="control-btn control-btn--skip"
        onClick={onSkipForward}
        disabled={!hasTrack || atEnd}
        aria-label={t("player.forwardSeconds", { seconds: skipSeconds })}
        title={t("player.forwardSecondsShort", { seconds: skipSeconds })}
      >
        <SkipForwardIcon width={36} height={36} />
        <span className="control-btn__label" aria-hidden="true">
          {skipSeconds}
        </span>
      </button>
    </div>
  );
});
