import type { Track } from "../types";

interface NowPlayingProps {
  track: Track | null;
}

export function NowPlaying({ track }: NowPlayingProps) {
  if (!track) {
    return (
      <div className="now-playing now-playing--empty">
        <div className="now-playing__art">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="currentColor" opacity="0.4">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
        </div>
        <div className="now-playing__info">
          <span className="now-playing__title">No track selected</span>
          <span className="now-playing__artist">Add music to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing__art now-playing__art--active">
        <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
      <div className="now-playing__info">
        <span className="now-playing__title">{track.title}</span>
        <span className="now-playing__artist">{track.artist}</span>
      </div>
    </div>
  );
}
