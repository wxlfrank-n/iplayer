import { useRef, useCallback, useState, useEffect } from "react";
import { useDrop } from "react-dnd";
import { NativeTypes } from "react-dnd-html5-backend";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useConfig } from "./hooks/useConfig";
import { useWaveform } from "./hooks/useWaveform";
import { AppHeader } from "./components/AppHeader";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerControls } from "./components/PlayerControls";
import { Playlist } from "./components/Playlist";
import { ProgressBar } from "./components/ProgressBar";
import { VolumeControl } from "./components/VolumeControl";
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

  const currentTrack =
    state.currentTrackIndex >= 0 ? state.tracks[state.currentTrackIndex] : null;

  const waveform = useWaveform(currentTrack?.url ?? null);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const handleFiles = useCallback(
    (files: FileList, playAfter: boolean = true) => {
      const { skipped } = addTracks(files, playAfter);
      if (skipped > 0) {
        showNotice(`Skipped ${skipped} non-MP3 file${skipped > 1 ? "s" : ""}. Only MP3 files are supported.`);
      }
    },
    [addTracks, showNotice],
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) handleFiles(e.target.files, false);
    e.target.value = "";
  };

  // Stop the page from scrolling/zooming on wheel anywhere in the app, except
  // inside the playlist's own scrollable track list.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest(".track-list")) return;
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  const [{ isOver }, drop] = useDrop(
    () => ({
      accept: [NativeTypes.FILE],
      drop: (item: { files?: FileList }) => {
        if (item.files && item.files.length > 0) handleFiles(item.files);
      },
      collect: (monitor) => ({ isOver: monitor.isOver() }),
    }),
    [handleFiles],
  );

  return (
    <div
      className={`app ${isOver ? "drag-over" : ""}`}
      ref={(node) => {
        if (node) drop(node);
      }}
    >
      <AppHeader
        trackCount={state.tracks.length}
        showPlaylist={showPlaylist}
        onTogglePlaylist={() => setShowPlaylist((v) => !v)}
        onOpenSettings={() => setShowSettings(true)}
      />

      <div className={`player-layout ${showPlaylist ? "player-layout--with-playlist" : ""}`}>
        <div className="player-main">
          <div className="player-card">
            <NowPlaying track={currentTrack} audioUrl={currentTrack?.url ?? null} />
            <ProgressBar
              key={currentTrack?.url ?? "none"}
              currentTime={state.currentTime}
              duration={state.duration}
              onSeek={seek}
              onPlay={play}
              waveform={waveform}
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
        </div>

        {showPlaylist && (
          <Playlist
            tracks={state.tracks}
            currentTrackIndex={state.currentTrackIndex}
            onSelectTrack={selectTrack}
            onRemoveTrack={removeTrack}
            onAddFiles={handleFileInput}
          />
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
