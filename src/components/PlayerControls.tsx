interface PlayerControlsProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onNext: () => void;
  onPrev: () => void;
  hasTrack: boolean;
}

export function PlayerControls({
  isPlaying,
  onTogglePlay,
  onNext,
  onPrev,
  hasTrack,
}: PlayerControlsProps) {
  return (
    <div className="player-controls">
      <button className="control-btn" onClick={onPrev} disabled={!hasTrack} title="Previous">
        {"\u23EE"}
      </button>
      <button
        className="control-btn control-btn--play"
        onClick={onTogglePlay}
        disabled={!hasTrack}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? "\u23F8" : "\u25B6"}
      </button>
      <button className="control-btn" onClick={onNext} disabled={!hasTrack} title="Next">
        {"\u23ED"}
      </button>
    </div>
  );
}
