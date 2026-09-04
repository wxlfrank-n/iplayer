import type { Track } from "../types";

interface TrackListProps {
  tracks: Track[];
  currentTrackIndex: number;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (index: number) => void;
}

export function TrackList({
  tracks,
  currentTrackIndex,
  onSelectTrack,
  onRemoveTrack,
}: TrackListProps) {
  if (tracks.length === 0) {
    return (
      <div className="track-list track-list--empty">
        <p>No tracks loaded</p>
        <p className="track-list__hint">Drop audio files here or use the button above</p>
      </div>
    );
  }

  return (
    <div className="track-list">
      {tracks.map((track, index) => (
        <div
          key={track.id}
          className={`track-item ${index === currentTrackIndex ? "track-item--active" : ""}`}
          onClick={() => onSelectTrack(index)}
        >
          <div className="track-item__info">
            <span className="track-item__number">{index + 1}</span>
            <div className="track-item__text">
              <span className="track-item__title">{track.title}</span>
              <span className="track-item__artist">{track.artist}</span>
            </div>
          </div>
          <button
            className="track-item__remove"
            onClick={(e) => {
              e.stopPropagation();
              onRemoveTrack(index);
            }}
            title="Remove track"
          >
            {"\u2715"}
          </button>
        </div>
      ))}
    </div>
  );
}
