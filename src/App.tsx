/**
 * Main application component.
 *
 * The root container that orchestrates:
 * - Audio playback (useAudioPlayer hook)
 * - Playlist management
 * - Waveform visualization and analysis
 * - Settings panel
 * - Drag-and-drop file loading
 * - Keyboard shortcuts and playback controls
 *
 * Layout:
 * - Main player card with waveform and controls
 * - Playlist sidebar (toggleable)
 * - Settings overlay (toggleable)
 *
 * Features:
 * - Load MP3 files via file input or drag-drop
 * - Play/pause with Web Audio for waveform visualization
 * - Skip forward/backward by configurable interval
 * - Seek via waveform click
 * - Range selection on waveform for looped playback
 * - Configurable skip interval and waveform display mode
 * - Auto-save config to localStorage
 */

import { useRef, useCallback, useState, useEffect, useMemo } from "react";
import { useAudioPlayer } from "./hooks/useAudioPlayer";
import { useConfig } from "./hooks/useConfig";
import { useWaveform } from "./hooks/useWaveform";
import { useAddFiles } from "./hooks/useAddFiles";
import { splitBySilence } from "./utils/clips";
import { useAppDispatch, useAppSelector } from "./store/hooks";
import { selectCurrentTrack } from "./store/selectors";
import { setClips, setActiveClip } from "./store/analysisSlice";
import { NowPlaying } from "./components/NowPlaying";
import { PlayerActions } from "./components/PlayerActions";
import { PlayerControls } from "./components/PlayerControls";
import { Playlist } from "./components/Playlist";
import { ProgressBar } from "./components/ProgressBar";
import { Settings } from "./components/Settings";
import "./App.css";

export default function App() {
  // Load user configuration from localStorage
  const { config } = useConfig();
  const dispatch = useAppDispatch();

  // Set up audio player with all playback controls and state
  const {
    togglePlay,
    next,
    prev,
    seek,
    addTracks,
    removeTrack,
    selectTrack,
    skipForward,
    skipBackward,
    playRange,
    getAnalyser,
    getCurrentTime,
  } = useAudioPlayer(config.skipSeconds);

  // UI state for overlays
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Temporary notification message (auto-hides after 4s)
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);

  // Get current playing track from the store
  const currentTrack = useAppSelector(selectCurrentTrack);

  // Decode and extract waveform data for visualization
  const waveform = useWaveform(currentTrack?.url ?? null);

  // Clips detected from the current audio's silence gaps, recomputed only
  // when the waveform (i.e. the loaded track) changes, then published to the
  // analysis slice so every component can read them.
  const clips = useMemo(
    () =>
      splitBySilence(
        waveform.data?.data ?? null,
        waveform.data?.sampleRate ?? 0,
      ),
    [waveform],
  );
  useEffect(() => {
    dispatch(setClips(clips));
  }, [clips, dispatch]);

  // Reset the active clip whenever the loaded track changes.
  useEffect(() => {
    dispatch(setActiveClip(-1));
  }, [currentTrack?.url, dispatch]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  // Adding files (file picker + drag-and-drop) with a skip notice for
  // non-MP3 files.
  const { handleFiles, isOver, drop } = useAddFiles(
    addTracks,
    useCallback(
      (skipped: number) =>
        showNotice(
          `Skipped ${skipped} non-MP3 file${skipped > 1 ? "s" : ""}. Only MP3 files are supported.`,
        ),
      [showNotice],
    ),
  );

  // Stop the page from scrolling/zooming on wheel anywhere in the app, except
  // inside the playlist's own scrollable track list.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target?.closest(".track-list") ||
        target?.closest(".stacked-waveform") ||
        target?.closest(".row-waveform")
      )
        return;
      e.preventDefault();
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div
      className={`app ${isOver ? "drag-over" : ""}`}
      ref={(node) => {
        if (node) drop(node);
      }}
    >
      <div className="player-layout">
        <div className="player-main">
          <PlayerActions
            playlistOpen={showPlaylist}
            onTogglePlaylist={() => setShowPlaylist((v) => !v)}
            onOpenSettings={() => setShowSettings(true)}
            onAddFiles={handleFiles}
          />

          <div className="player-card">
            <NowPlaying />
            <ProgressBar
              key={currentTrack?.url ?? "none"}
              onSeek={seek}
              onPlayRange={playRange}
              getAnalyser={getAnalyser}
              getCurrentTime={getCurrentTime}
            />
            <PlayerControls
              onTogglePlay={togglePlay}
              onNext={next}
              onPrev={prev}
              onSkipForward={skipForward}
              onSkipBackward={skipBackward}
            />
          </div>
        </div>
      </div>

      {showPlaylist && (
        <Playlist
          onSelectTrack={selectTrack}
          onRemoveTrack={removeTrack}
          onAddFiles={handleFiles}
          onClose={() => setShowPlaylist(false)}
        />
      )}

      {showSettings && <Settings onClose={() => setShowSettings(false)} />}

      {notice && <div className="app-notice">{notice}</div>}
    </div>
  );
}
