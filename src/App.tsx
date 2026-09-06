import { useRef, useCallback, useState } from "react";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useConfig } from "./hooks/useConfig";
import { useWaveform } from "./hooks/useWaveform";
import { isMp3File, toFileList } from "./utils/audioFiles";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerControls } from "./components/PlayerControls";
import { ProgressBar } from "./components/ProgressBar";
import { VolumeControl } from "./components/VolumeControl";
import { TrackList } from "./components/TrackList";
import { Settings } from "./components/Settings";
import "./App.css";

export default function App() {
  const { config, updateConfig } = useConfig();
  const {
    state,
    togglePlay,
    play,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    addTracks,
    removeTrack,
    selectTrack,
    skipForward,
    skipBackward,
    playRange,
  } = useAudioPlayer(config.skipSeconds);

  const [showPlaylist, setShowPlaylist] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const currentTrack =
    state.currentTrackIndex >= 0 ? state.tracks[state.currentTrackIndex] : null;

  const peaks = useWaveform(currentTrack?.url ?? null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const handleFiles = useCallback(
    (files: FileList) => {
      const all = Array.from(files);
      const mp3s = all.filter(isMp3File);
      const skipped = all.length - mp3s.length;
      if (mp3s.length > 0) addTracks(toFileList(mp3s));
      if (skipped > 0) {
        showNotice(`Skipped ${skipped} non-MP3 file${skipped > 1 ? "s" : ""}. Only MP3 files are supported.`);
      }
    },
    [addTracks, showNotice],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files);
    e.target.value = "";
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
        <div className="app-header-actions">
          <button
            className={`playlist-toggle ${showPlaylist ? "playlist-toggle--active" : ""}`}
            onClick={() => setShowPlaylist((v) => !v)}
            title={showPlaylist ? "Hide playlist" : "Show playlist"}
          >
            {"\u{1F4CB}"} Playlist ({state.tracks.length})
          </button>
          <button
            className="settings-btn"
            onClick={() => setShowSettings(true)}
            title="Settings"
          >
            <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
            </svg>
          </button>
        </div>
      </header>

      <div className={`player-layout ${showPlaylist ? "player-layout--with-playlist" : ""}`}>
        <div className="player-main">
          <NowPlaying track={currentTrack} audioUrl={currentTrack?.url ?? null} />
          <ProgressBar
            key={currentTrack?.url ?? "none"}
            url={currentTrack?.url ?? null}
            currentTime={state.currentTime}
            duration={state.duration}
            onSeek={seek}
            onPlay={play}
            peaks={peaks}
            onPlayRange={playRange}
          />
          <div className="player-bottom">
            <PlayerControls
              isPlaying={state.isPlaying}
              onTogglePlay={togglePlay}
              onNext={next}
              onPrev={prev}
              onSkipForward={skipForward}
              onSkipBackward={skipBackward}
              hasTrack={state.tracks.length > 0}
              skipSeconds={config.skipSeconds}
            />
            <VolumeControl
              volume={state.volume}
              isMuted={state.isMuted}
              onVolumeChange={setVolume}
              onToggleMute={toggleMute}
            />
          </div>
        </div>

        {showPlaylist && (
          <div className="playlist-section">
            <div className="playlist-header">
              <h2>Playlist ({state.tracks.length})</h2>
              <button className="add-btn" onClick={() => fileInputRef.current?.click()}>
                + Add MP3
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".mp3,audio/mpeg"
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
        )}
      </div>

      {showSettings && (
        <Settings
          skipSeconds={config.skipSeconds}
          onSkipSecondsChange={(v) => updateConfig({ skipSeconds: v })}
          onClose={() => setShowSettings(false)}
        />
      )}

      {notice && <div className="app-notice">{notice}</div>}
    </div>
  );
}
