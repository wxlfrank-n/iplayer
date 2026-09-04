import type { Track } from "../types";

interface NowPlayingProps {
  track: Track | null;
}

export function NowPlaying({ track }: NowPlayingProps) {
  if (!track) {
    return (
      <div className="now-playing now-playing--empty">
        <div className="now-playing__art">{"\u{1F3B5}"}</div>
        <div className="now-playing__info">
          <span className="now-playing__title">No track selected</span>
          <span className="now-playing__artist">Add music to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing__art">{"\u{1F3B5}"}</div>
      <div className="now-playing__info">
        <span className="now-playing__title">{track.title}</span>
        <span className="now-playing__artist">{track.artist}</span>
      </div>
    </div>
  );
}
