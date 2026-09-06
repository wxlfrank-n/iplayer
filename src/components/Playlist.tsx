import { useRef } from "react";
import type { Track } from "../types";
import { TrackList } from "./TrackList";

interface PlaylistProps {
  tracks: Track[];
  currentTrackIndex: number;
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onAddFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export function Playlist({
  tracks,
  currentTrackIndex,
  onSelectTrack,
  onRemoveTrack,
  onAddFiles,
}: PlaylistProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="playlist-section">
      <div className="playlist-header">
        <h2>Playlist ({tracks.length})</h2>
        <button className="add-btn" onClick={() => fileInputRef.current?.click()}>
          + Add MP3
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          onChange={onAddFiles}
          style={{ display: "none" }}
        />
      </div>
      <TrackList
        tracks={tracks}
        currentTrackIndex={currentTrackIndex}
        onSelectTrack={onSelectTrack}
        onRemoveTrack={onRemoveTrack}
      />
    </div>
  );
}