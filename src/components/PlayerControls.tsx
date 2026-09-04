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
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
        </svg>
      </button>
      <button
        className="control-btn control-btn--play"
        onClick={onTogglePlay}
        disabled={!hasTrack}
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>
      <button className="control-btn" onClick={onNext} disabled={!hasTrack} title="Next">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
        </svg>
      </button>
    </div>
  );
}
