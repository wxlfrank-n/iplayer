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
import { EmptyState } from "./components/EmptyState";
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
  const [notice, setNotice] = useState<{
    msg: string;
    type: "info" | "error";
  } | null>(null);
  const noticeTimerRef = useRef<number | undefined>(undefined);

  // Remember which element opened an overlay so focus can be returned on close.
  const lastFocusRef = useRef<HTMLElement | null>(null);
  const restoreFocus = useCallback(() => {
    requestAnimationFrame(() => lastFocusRef.current?.focus());
  }, []);
  const togglePlaylist = useCallback(() => {
    if (!showPlaylist) {
      lastFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    }
    setShowPlaylist((v) => !v);
  }, [showPlaylist]);
  const openSettings = useCallback(() => {
    lastFocusRef.current = (document.activeElement as HTMLElement) ?? null;
    setShowSettings(true);
  }, []);
  const closePlaylist = useCallback(() => {
    setShowPlaylist(false);
    restoreFocus();
  }, [restoreFocus]);
  const closeSettings = useCallback(() => {
    setShowSettings(false);
    restoreFocus();
  }, [restoreFocus]);

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
        {
          blockMs: config.blockMs,
          silenceRatio: config.silenceRatio,
          minSilenceLength: config.minSilenceLength,
          minClipLength: config.minClipLength,
        },
      ),
    [waveform, config.blockMs, config.silenceRatio, config.minSilenceLength, config.minClipLength],
  );
  useEffect(() => {
    dispatch(setClips(clips));
  }, [clips, dispatch]);

  // Reset the active clip whenever the loaded track changes.
  useEffect(() => {
    dispatch(setActiveClip(-1));
  }, [currentTrack?.url, dispatch]);

  const showNotice = useCallback(
    (msg: string, type: "info" | "error" = "info") => {
      setNotice({ msg, type });
      window.clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = window.setTimeout(() => setNotice(null), 4000);
    },
    [],
  );

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
            onTogglePlaylist={togglePlaylist}
            onOpenSettings={openSettings}
          />

          {currentTrack ? (
            <div className="player-card">
              <NowPlaying />
              <ProgressBar
                key={currentTrack?.url ?? "none"}
                onSeek={seek}
                onPlayRange={playRange}
                onStopPlayback={togglePlay}
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
          ) : (
            <EmptyState onAddFiles={handleFiles} />
          )}
        </div>
      </div>

      {showPlaylist && (
        <Playlist
          onSelectTrack={selectTrack}
          onRemoveTrack={removeTrack}
          onAddFiles={handleFiles}
          onClose={closePlaylist}
        />
      )}

      {showSettings && <Settings onClose={closeSettings} />}

      {notice && (
        <div
          className={`app-notice app-notice--${notice.type}`}
          role="status"
          aria-live="polite"
        >
          {notice.msg}
        </div>
      )}
    </div>
  );
}
