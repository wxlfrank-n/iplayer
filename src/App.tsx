import { useRef, useCallback } from "react";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerControls } from "./components/PlayerControls";
import { ProgressBar } from "./components/ProgressBar";
import { VolumeControl } from "./components/VolumeControl";
import { TrackList } from "./components/TrackList";
import "./App.css";

export default function App() {
  const {
    state,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    addTracks,
    removeTrack,
    selectTrack,
  } = useAudioPlayer();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const currentTrack =
    state.currentTrackIndex >= 0 ? state.tracks[state.currentTrackIndex] : null;

  const handleFiles = useCallback(
    (files: FileList) => {
      addTracks(files);
    },
    [addTracks],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.remove("drag-over");
    if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dropRef.current?.classList.add("drag-over");
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dropRef.current?.classList.remove("drag-over");
  };

  return (
    <div
      className="app"
      ref={dropRef}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
    >
      <header className="app-header">
        <h1 className="app-title">{"\u{1F3B5}"} MyPlayer</h1>
      </header>

      <div className="player-layout">
        <div className="player-main">
          <NowPlaying track={currentTrack} />
          <ProgressBar
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={seek}
          />
          <div className="player-bottom">
            <PlayerControls
              isPlaying={state.isPlaying}
              onTogglePlay={togglePlay}
              onNext={next}
              onPrev={prev}
              hasTrack={state.tracks.length > 0}
            />
            <VolumeControl
              volume={state.volume}
              isMuted={state.isMuted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
          </div>
        </div>

        <div className="playlist-section">
          <div className="playlist-header">
            <h2>Playlist ({state.tracks.length})</h2>
            <button className="add-btn" onClick={() => fileInputRef.current?.click()}>
              + Add Files
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              multiple
              onChange={handleFileInput}
              style={{ display: "none" }}
            />
          </div>
          <TrackList
            tracks={state.tracks}
            currentTrackIndex={state.currentTrackIndex}
            onSelectTrack={selectTrack}
            onRemoveTrack={removeTrack}
          />
        </div>
      </div>
    </div>
  );
}
