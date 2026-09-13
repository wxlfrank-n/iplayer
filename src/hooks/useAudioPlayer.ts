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
  setVolume,
  setIsMuted,
} from "../store/playerSlice";

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
  const wavBlobCacheRef = useRef<Map<string, string>>(new Map());
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
      expectedRawUrlRef.current = url;
      try {
        const playableUrl = await getPlayableUrl(url);
        // Only update if this is still the expected URL
        if (expectedRawUrlRef.current === url) {
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
        if (expectedRawUrlRef.current === url) {
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
    const onEnded = () => nextRef.current();
    const onError = () => console.error("Audio error", audio.error);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
    };
  }, [dispatch]);

  useEffect(() => {
    audioRef.current.volume = state.volume;
  }, [state.volume]);

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

  const stopRangeMonitoring = useCallback(() => {
    if (rangeRafRef.current) {
      cancelAnimationFrame(rangeRafRef.current);
      rangeRafRef.current = 0;
    }
  }, []);

  const pause = useCallback(() => {
    stopRangeMonitoring();
    audioRef.current.pause();
    dispatch(setIsPlaying(false));
  }, [dispatch, stopRangeMonitoring]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (getPlayer().isPlaying) {
      // Pause playback
      stopRangeMonitoring();
      audio.pause();
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

  const setVolumeLevel = useCallback(
    (vol: number) => {
      audioRef.current.volume = vol;
      dispatch(setVolume(vol));
      dispatch(setIsMuted(vol === 0));
    },
    [dispatch],
  );

  const toggleMute = useCallback(() => {
    const s = getPlayer();
    const newMuted = !s.isMuted;
    const audio = audioRef.current;
    audio.volume = newMuted ? 0 : s.volume;
    audio.muted = newMuted;
    dispatch(setIsMuted(newMuted));
  }, [dispatch]);

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
  const playRange = useCallback(
    (
      start: number,
      end: number,
      repetitions: number,
      onComplete?: () => void,
    ) => {
      const audio = audioRef.current;
      getAnalyser();
      stopRangeMonitoring();

      if (rangeEndedRef.current) {
        audio.removeEventListener("ended", rangeEndedRef.current);
        rangeEndedRef.current = null;
      }

      let count = 0;
      let armedAtStart = false;
      const startTs = performance.now();

      const stopLoop = () => {
        if (rangeRafRef.current) {
          cancelAnimationFrame(rangeRafRef.current);
          rangeRafRef.current = 0;
        }
      };

      const cleanupRange = () => {
        stopLoop();
        if (rangeEndedRef.current) {
          audio.removeEventListener("ended", rangeEndedRef.current);
          rangeEndedRef.current = null;
        }
      };

      const tick = () => {
        if (!rangeRafRef.current) return;
        const t = audio.currentTime;

        // Wait until the seek to `start` has actually settled before trusting the
        // playhead: in the first frames after a click the media can still report
        // its old position (usually 0 when paused), which must not be mistaken
        // for the clip end or a cancelled source.
        if (!armedAtStart) {
          const nearStart = t >= start - 0.05 && t <= start + 0.1;
          if (nearStart) {
            armedAtStart = true;
          } else if (performance.now() - startTs < 250) {
            rangeRafRef.current = requestAnimationFrame(tick);
            return;
          }
        }

        // Only considered a cancelled/ended source once the seek to `start` was
        // seen — a stale pre-seek position must never trigger this.
        if (armedAtStart && t < start - 0.05) {
          stopLoop();
          return;
        }

        if (t >= end) {
          count++;
          if (count >= repetitions) {
            audio.pause();
            audio.currentTime = end;
            cleanupRange();
            dispatch(setIsPlaying(false));
            dispatch(setCurrentTime(end));
            onComplete?.();
            return;
          }
          audio.currentTime = start;
          armedAtStart = true;
          dispatch(setCurrentTime(start));
        }
        rangeRafRef.current = requestAnimationFrame(tick);
      };

      // If the clip's end coincides with the end of the file, the audio element
      // can fire `ended` before the last rAF frame — handle it as a full pass
      // instead of letting the next track start.
      const onEnded = () => {
        if (!rangeRafRef.current) return;
        count++;
        if (count >= repetitions) {
          audio.pause();
          cleanupRange();
          dispatch(setIsPlaying(false));
          dispatch(setCurrentTime(end));
          onComplete?.();
          return;
        }
        audio.currentTime = start;
        armedAtStart = true;
        dispatch(setCurrentTime(start));
        audio
          .play()
          .then(() => dispatch(setIsPlaying(true)))
          .catch(() => {});
        rangeRafRef.current = requestAnimationFrame(tick);
      };

      rangeEndedRef.current = onEnded;
      audio.addEventListener("ended", onEnded);

      // Sync the playhead immediately; otherwise the wave keeps showing the old
      // position until the first event fires. Snap back to `start` when playback
      // actually begins so the opening is not skipped.
      snatchToStart(audio, start);
      audio.currentTime = start;
      dispatch(setCurrentTime(start));
      audio
        .play()
        .then(() => dispatch(setIsPlaying(true)))
        .catch(() => {});
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
    setVolume: setVolumeLevel,
    toggleMute,
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
