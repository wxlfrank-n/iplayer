import { useRef, useCallback, useEffect } from "react";
import type { Track } from "../types";
import { decodeAudioBuffer, initializeAudioContext } from "../utils/audio";
import { audioBufferToWavBlob } from "../utils/wav";
import { store } from "../store/store";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setTracks,
  setCurrentTrackIndex,
  setIsPlaying,
  setCurrentTime,
  setDuration,
} from "../store/playerSlice";

// iOS devices (including Chrome on iPhone, which uses the WebKit engine)
// cannot route an <audio> element through the Web Audio graph reliably:
// `createMediaElementSource` is broken on iOS/WebKit — the element's timeline
// and the audible output diverge, so seeking is unreliable and clip loops play
// stale content / skip rounds. On those devices playback must go straight to
// the speakers (the dancing-lines canvas simply has no live data).
const isIOS =
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// When playback starts after a seek, the browser may begin slightly past the
// requested position (preroll/seek settling), skipping the very beginning.
// Snap the playhead back to `time` once rendering actually starts.
function snatchToStart(audio: HTMLAudioElement, time: number) {
  const onPlaying = () => {
    if (Math.abs(audio.currentTime - time) > 0.08) {
      audio.currentTime = time;
    }
    audio.removeEventListener("playing", onPlaying);
  };
  audio.addEventListener("playing", onPlaying);
}

export function useAudioPlayer(skipSeconds: number) {
  const dispatch = useAppDispatch();
  // Live playback state, kept in Redux so every component shares it.
  const state = useAppSelector((s) => s.player);

  // Fresh read of player state for imperative callbacks (event handlers, rAF).
  const getPlayer = () => store.getState().player;

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nextRef = useRef<() => void>(() => {});
  const expectedRawUrlRef = useRef<string | null>(null);
  const trackLoadIdRef = useRef(0);
  const wavBlobCacheRef = useRef<Map<string, string>>(new Map());
  // True while a clip range is paused only to seek back to its start for the
  // next repetition. During that window the element's native `pause` event and
  // the range restart must not publish isPlaying=false, or the waveform views
  // would see playback "stop" at every loop.
  const suppressRangePauseRef = useRef(false);
  // Lazily-created Web Audio graph wired through the audio element; feeding the
  // final music through the analyser lets the UI draw live dancing lines.
  const analyserRef = useRef<{
    ctx: AudioContext;
    analyser: AnalyserNode;
  } | null>(null);

  /**
   * Gets or creates the Web Audio analyser node for waveform visualization.
   * Creates the shared AudioContext on first call (user gesture required).
   *
   * The analyser node provides real-time frequency data used to draw the
   * waveform visualization component (Waveform.tsx, RowWaveform.tsx).
   *
   * Architecture:
   * - HTMLAudioElement → MediaElementAudioSourceNode → AnalyserNode → Destination
   * - This lets us visualize without interfering with playback
   *
   * @param resume - Whether to resume the context if suspended (default: true)
   * @returns AnalyserNode for waveform data, or null if creation failed
   */
  const getAnalyser = useCallback(
    (resume: boolean = true): AnalyserNode | null => {
      if (isIOS) return null;
      if (!resume && !analyserRef.current) return null;
      // Return existing analyser if already created
      if (analyserRef.current) {
        // Resume context if needed (e.g., after pause)
        if (resume && analyserRef.current.ctx.state === "suspended") {
          analyserRef.current.ctx.resume().catch(() => {});
        }
        return analyserRef.current.analyser;
      }
      try {
        // Initialize shared AudioContext on user gesture (must be from play click)
        const ctx = initializeAudioContext();

        // Create analyser for frequency data (used by waveform visualization)
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024; // Balance between resolution and performance
        analyser.smoothingTimeConstant = 0.72; // Smooth transitions in frequency data

        // Wire up audio graph: audio element → analyser → speakers
        const src = ctx.createMediaElementSource(audioRef.current); // src = the audio element's single entry point into the Web Audio graph
        src.connect(analyser);
        analyser.connect(ctx.destination);

        // Cache for later use
        analyserRef.current = { ctx, analyser };

        // Resume context if suspended (required by autoplay policy)
        if (resume && ctx.state === "suspended") {
          ctx.resume().catch(() => {});
        }

        return analyser;
      } catch (err) {
        console.debug("Failed to create analyser:", err);
        return null; // Graceful fallback if Web Audio not supported
      }
    },
    [],
  );

  const getCurrentTime = useCallback(() => audioRef.current.currentTime, []);

  /**
   * Gets or creates a playable audio URL by decoding and re-encoding as WAV.
   * Uses a cache to avoid redundant decoding operations.
   *
   * The WAV re-encoding ensures consistent format across browsers and allows
   * proper waveform extraction by other components.
   *
   * @param url - The URL of the original audio file
   * @returns A blob URL pointing to the WAV-encoded audio data
   */
  const getPlayableUrl = useCallback(async (url: string): Promise<string> => {
    const cache = wavBlobCacheRef.current;
    const cached = cache.get(url);
    if (cached) return cached;

    const { buffer } = await decodeAudioBuffer(url);
    const blob = audioBufferToWavBlob(buffer);
    const objectUrl = URL.createObjectURL(blob);
    cache.set(url, objectUrl);
    return objectUrl;
  }, []);

  // Point the audio element at a new source and start playing it.
  /**
   * Loads and starts playback of a new audio track.
   * Handles both WAV-encoded playback and raw audio URL fallback.
   *
   * Flow:
   * 1. Initialize AudioContext for Web Audio features (waveform visualization)
   * 2. Decode audio file to WAV format for consistent playback
   * 3. Fall back to raw URL if decoding fails
   * 4. Load and play the audio element
   *
   * @param audio - The HTMLAudioElement to use for playback
   * @param url - The URL of the audio file to load
   */
  const startTrack = useCallback(
    async (audio: HTMLAudioElement, url: string) => {
      // Initialize AudioContext on user gesture (from next/prev buttons or click)
      getAnalyser();
      const loadId = ++trackLoadIdRef.current;
      audio.pause();
      dispatch(setIsPlaying(false));
      expectedRawUrlRef.current = url;
      try {
        const playableUrl = await getPlayableUrl(url);
        // Only update if this is still the expected URL
        if (trackLoadIdRef.current === loadId && expectedRawUrlRef.current === url) {
          audio.src = playableUrl;
          audio.load();
          audio
            .play()
            .then(() => dispatch(setIsPlaying(true)))
            .catch((err) => {
              console.debug("Start track play failed:", err);
            });
        }
      } catch (error) {
        console.error("Failed to decode audio for playback:", error);
        // Fallback to raw URL if decoding fails
        if (trackLoadIdRef.current === loadId && expectedRawUrlRef.current === url) {
          audio.src = url;
          audio.load();
          audio
            .play()
            .then(() => dispatch(setIsPlaying(true)))
            .catch((err) => {
              console.debug("Fallback play failed:", err);
            });
        }
      }
    },
    [dispatch, getAnalyser, getPlayableUrl],
  );

  useEffect(() => {
    nextRef.current = () => {
      const s = getPlayer();
      if (s.tracks.length === 0) return;
      const nextIndex = (s.currentTrackIndex + 1) % s.tracks.length;
      const track = s.tracks[nextIndex];
      if (!track) return;
      startTrack(audioRef.current, track.url);
      dispatch(setCurrentTrackIndex(nextIndex));
      dispatch(setCurrentTime(0));
      dispatch(setDuration(0));
    };
  });

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      dispatch(setCurrentTime(audio.currentTime));
    };
    const onLoadedMetadata = () => dispatch(setDuration(audio.duration));
    const onPlay = () => dispatch(setIsPlaying(true));
    const onPause = () => {
      // A transient pause fired purely to seek a clip range back to its start.
      // The loop is still "playing" — publishing isPlaying=false here would
      // flip the waveform views' follow state off at every repetition.
      if (suppressRangePauseRef.current) return;
      dispatch(setIsPlaying(false));
    };
    const onEnded = () => {
      // While a clip/sector is looping, the range owns the element's `ended`
      // event — a clip ending exactly at the file end must not jump to the
      // next track mid-loop.
      if (audioRef.current.dataset.clipLoopActive === "1") return;
      nextRef.current();
    };
    const onError = () => {
      dispatch(setIsPlaying(false));
      console.error("Audio error", audio.error);
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [dispatch]);

  useEffect(() => {
    const audio = audioRef.current;
    const track = state.tracks[state.currentTrackIndex];
    if (track && !audio.src) {
      expectedRawUrlRef.current = track.url;
      getPlayableUrl(track.url)
        .then((playableUrl) => {
          if (expectedRawUrlRef.current === track.url && !audio.src) {
            audio.src = playableUrl;
            audio.load();
          }
        })
        .catch((error) => {
          console.error("Failed to decode initial audio:", error);
          if (expectedRawUrlRef.current === track.url && !audio.src) {
            audio.src = track.url;
            audio.load();
          }
        });
    }
  }, [state.tracks, state.currentTrackIndex, getPlayableUrl]);

  const play = useCallback(() => {
    // Initialize shared AudioContext on first user gesture (play click)
    // This complies with browser autoplay policy and enables Web Audio features
    getAnalyser();
    audioRef.current
      .play()
      .then(() => dispatch(setIsPlaying(true)))
      .catch((err) => {
        console.debug("Play failed (may retry):", err);
      });
  }, [dispatch, getAnalyser]);

  // Reference to the range's active rAF loop / ended listener so that starting a
  // new range (e.g. clicking another clip) drops the previous one instead of
  // letting the old range keep looping/pausing.
  const rangeRafRef = useRef(0);
  const rangeEndedRef = useRef<(() => void) | null>(null);
  // Monotonic id so a late callback (stale resume timer / event) from a
  // previous range can never touch the state of the range that replaced it.
  const rangeRunIdRef = useRef(0);

  const stopRangeMonitoring = useCallback(() => {
    if (rangeRafRef.current) {
      cancelAnimationFrame(rangeRafRef.current);
      rangeRafRef.current = 0;
    }
    const audio = audioRef.current;
    if (rangeEndedRef.current) {
      audio.removeEventListener("ended", rangeEndedRef.current);
      rangeEndedRef.current = null;
    }
    audio.dataset.clipLoopActive = "0";
    suppressRangePauseRef.current = false;
  }, []);

  const pause = useCallback(() => {
    stopRangeMonitoring();
    const audio = audioRef.current;
    audio.pause();
    dispatch(setCurrentTime(audio.currentTime));
    dispatch(setIsPlaying(false));
  }, [dispatch, stopRangeMonitoring]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (getPlayer().isPlaying) {
      // Pause playback
      stopRangeMonitoring();
      audio.pause();
      dispatch(setCurrentTime(audio.currentTime));
      dispatch(setIsPlaying(false));
      return;
    }
    // Resume playback and initialize AudioContext (user gesture)
    getAnalyser();
    audio
      .play()
      .then(() => dispatch(setIsPlaying(true)))
      .catch((err) => {
        console.debug("Toggle play failed (may retry):", err);
      });
  }, [dispatch, getAnalyser, stopRangeMonitoring]);

  const next = useCallback(() => {
    nextRef.current();
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    const s = getPlayer();
    if (s.tracks.length === 0) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      dispatch(setCurrentTime(0));
      return;
    }
    const prevIndex =
      (s.currentTrackIndex - 1 + s.tracks.length) % s.tracks.length;
    const track = s.tracks[prevIndex];
    if (!track) return;
    startTrack(audio, track.url);
    dispatch(setCurrentTrackIndex(prevIndex));
    dispatch(setCurrentTime(0));
    dispatch(setDuration(0));
  }, [dispatch, startTrack]);

  const seek = useCallback(
    (time: number) => {
      const audio = audioRef.current;
      if (audio.paused) snatchToStart(audio, time);
      audio.currentTime = time;
      console.debug("Seek to:", time);
      dispatch(setCurrentTime(time));
    },
    [dispatch],
  );

  const addTracks = useCallback(
    (files: FileList, playAfter: boolean = false) => {
      const all = Array.from(files);
      const mp3Files = all.filter((f) => f.name.toLowerCase().endsWith(".mp3"));
      const skipped = all.length - mp3Files.length;
      const newTracks: Track[] = mp3Files.map((file) => ({
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^/.]+$/, ""),
        artist: "Unknown Artist",
        duration: 0,
        url: URL.createObjectURL(file),
        file,
      }));
      if (newTracks.length === 0) return { added: 0, skipped };

      const s = getPlayer();
      const startIndex = s.tracks.length;
      dispatch(setTracks([...s.tracks, ...newTracks]));

      if (playAfter || s.currentTrackIndex === -1) {
        const track = newTracks[0];
        if (track) {
          setTimeout(() => startTrack(audioRef.current, track.url), 0);
          dispatch(setCurrentTrackIndex(startIndex));
          dispatch(setCurrentTime(0));
          dispatch(setDuration(0));
        }
      }

      return { added: newTracks.length, skipped };
    },
    [dispatch, startTrack],
  );

  const removeTrack = useCallback(
    (index: number) => {
      const s = getPlayer();
      const newTracks = s.tracks.filter((_, i) => i !== index);
      let newIndex = s.currentTrackIndex;
      const audio = audioRef.current;

      if (index === s.currentTrackIndex) {
        if (newTracks.length === 0) {
          trackLoadIdRef.current += 1;
          expectedRawUrlRef.current = null;
          newIndex = -1;
          audio.pause();
          audio.src = "";
        } else {
          newIndex = Math.min(index, newTracks.length - 1);
          const track = newTracks[newIndex];
          if (track) startTrack(audio, track.url);
        }
      } else if (index < s.currentTrackIndex) {
        newIndex = s.currentTrackIndex - 1;
      }

      dispatch(setTracks(newTracks));
      dispatch(setCurrentTrackIndex(newIndex));
    },
    [dispatch, startTrack],
  );

  const selectTrack = useCallback(
    (index: number) => {
      const s = getPlayer();
      const track = s.tracks[index];
      if (!track) return;
      startTrack(audioRef.current, track.url);
      dispatch(setCurrentTrackIndex(index));
      dispatch(setCurrentTime(0));
      dispatch(setDuration(0));
    },
    [dispatch, startTrack],
  );

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    const newTime = Math.min(
      audio.currentTime + skipSeconds,
      audio.duration || 0,
    );
    audio.currentTime = newTime;
    dispatch(setCurrentTime(newTime));
  }, [dispatch, skipSeconds]);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    const newTime = Math.max(audio.currentTime - skipSeconds, 0);
    audio.currentTime = newTime;
    dispatch(setCurrentTime(newTime));
  }, [dispatch, skipSeconds]);

  // Plays the given time range [start, end] `repetitions` times sequentially,
  // pausing at `end` after the last repetition. Calls onComplete when finished.
  // Boundary detection runs on requestAnimationFrame (not the ~250ms
  // `timeupdate` cadence), so a clip stops within a frame of its end and
  // loops restart exactly at `start` instead of drifting.
  //
  // iOS/WebKit robustness: assigning `audio.currentTime` on a *playing*
  // element is applied asynchronously and can be delayed or ignored entirely,
  // leaving the audible output playing the previous region. Every loop restart
  // therefore pauses first, seeks, and only resumes once the seek has settled;
  // while it settles, a `seeking` guard ignores stale playhead reads so a
  // boundary is never counted twice (which used to skip/finish rounds early).
  const playRange = useCallback(
    (
      start: number,
      end: number,
      repetitions: number,
      onComplete?: () => void,
    ) => {
      const audio = audioRef.current;
      getAnalyser();
      // Drops any previous clip loop (rAF + ended listener) so clicking a new
      // clip can never resurrect the previous one.
      stopRangeMonitoring();
      audio.dataset.clipLoopActive = "1";

      const runId = ++rangeRunIdRef.current;
      let count = 0;
      // True until the playhead is observed near `start` after a seek. While
      // true the (possibly stale) currentTime is ignored, so the same boundary
      // can never be counted twice while iOS settles the seek.
      let seeking = true;
      let seekRequestTs = performance.now();
      let recoveryAttempts = 0;
      let resumeTimer = 0;

      const cancelResume = () => {
        if (resumeTimer) {
          window.clearTimeout(resumeTimer);
          resumeTimer = 0;
        }
      };

      const stopLoop = () => {
        if (rangeRafRef.current) {
          cancelAnimationFrame(rangeRafRef.current);
          rangeRafRef.current = 0;
        }
      };

      const cleanupRange = () => {
        cancelResume();
        stopLoop();
        if (rangeEndedRef.current) {
          audio.removeEventListener("ended", rangeEndedRef.current);
          rangeEndedRef.current = null;
        }
        audio.dataset.clipLoopActive = "0";
      };

      const abortLoop = () => {
        cleanupRange();
        audio.pause();
        dispatch(setIsPlaying(false));
        dispatch(setCurrentTime(audio.currentTime));
        onComplete?.();
      };

      const finishLoop = () => {
        audio.pause();
        audio.currentTime = end;
        cleanupRange();
        dispatch(setIsPlaying(false));
        dispatch(setCurrentTime(end));
        onComplete?.();
      };

      const resetToStart = () => {
        if (runId !== rangeRunIdRef.current) return;
        seeking = true;
        seekRequestTs = performance.now();
        cancelResume();
        // The pause+seek below is a loop restart, not a user pause: keep
        // isPlaying true across it so the waveform views never see playback
        // stop mid-range.
        suppressRangePauseRef.current = true;
        audio.pause();
        audio.currentTime = start;
        dispatch(setCurrentTime(start));
        // Let the paused seek settle before resuming so iOS honors it.
        resumeTimer = window.setTimeout(() => {
          suppressRangePauseRef.current = false;
          if (runId !== rangeRunIdRef.current) return;
          resumeTimer = 0;
          snatchToStart(audio, start);
          audio
            .play()
            .then(() => dispatch(setIsPlaying(true)))
            .catch(() => {});
        }, 50);
      };

      const tick = () => {
        if (!rangeRafRef.current) return;
        const t = audio.currentTime;

        if (seeking) {
          const nearStart = t >= start - 0.05 && t <= start + 0.15;
          if (nearStart) {
            seeking = false;
          } else if (performance.now() - seekRequestTs > 3000) {
            // The seek never settled (iOS can ignore seeks on a live element).
            // Retry once from a paused state, then give up cleanly.
            if (recoveryAttempts < 1) {
              recoveryAttempts++;
              audio.pause();
              audio.currentTime = start;
              seekRequestTs = performance.now();
              audio
                .play()
                .then(() => dispatch(setIsPlaying(true)))
                .catch(() => {});
            } else {
              abortLoop();
              return;
            }
          }
        } else {
          if (t >= end) {
            count++;
            if (count >= repetitions) {
              finishLoop();
              return;
            }
            resetToStart();
          } else if (t < start - 0.05) {
            // A round was armed but the playhead dropped behind `start`: the
            // media restarted/cancelled unexpectedly. Stop cleanly instead of
            // counting phantom rounds.
            abortLoop();
            return;
          }
        }
        rangeRafRef.current = requestAnimationFrame(tick);
      };

      // The media element's own `ended` fires when playback reaches the end of
      // the file. When a clip ends exactly at the file end this is the last
      // chance to observe the boundary; the global "ended" handler (next
      // track) is suppressed while the range is active.
      const onEnded = () => {
        if (!rangeRafRef.current) return;
        if (seeking) return; // boundary already counted by the tick loop
        count++;
        if (count >= repetitions) {
          finishLoop();
          return;
        }
        resetToStart();
      };

      rangeEndedRef.current = onEnded;
      audio.addEventListener("ended", onEnded);

      resetToStart();
      rangeRafRef.current = requestAnimationFrame(tick);
    },
    [dispatch, getAnalyser, stopRangeMonitoring],
  );

  return {
    state,
    play,
    pause,
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
  };
}
