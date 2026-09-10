import { useState, useRef, useCallback, useEffect } from "react";
import type { Track } from "../types";
import { DEFAULT_TRACKS } from "../defaultTracks";
import { decodeAudioBuffer } from "../utils/audio";
import { audioBufferToWavBlob } from "../utils/wav";

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

export interface PlayerState {
  tracks: Track[];
  currentTrackIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
}

export function useAudioPlayer(skipSeconds: number) {
  const defaultTracks: Track[] = DEFAULT_TRACKS.map((t) => ({
    id: t.filename,
    title: t.title,
    artist: "Unknown Artist",
    duration: 0,
    url: `${import.meta.env.VITE_BASE_URL}music/${t.filename}`,
    file: undefined,
  }));

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nextRef = useRef<() => void>(() => {});
  const expectedRawUrlRef = useRef<string | null>(null);
  const wavBlobCacheRef = useRef<Map<string, string>>(new Map());
  // Lazily-created Web Audio graph wired through the audio element; feeding the
  // final music through the analyser lets the UI draw live dancing lines.
  const analyserRef = useRef<{ ctx: AudioContext; analyser: AnalyserNode } | null>(null);

  const getAnalyser = useCallback((): AnalyserNode | null => {
    if (analyserRef.current) {
      if (analyserRef.current.ctx.state === "suspended") {
        analyserRef.current.ctx.resume().catch(() => {});
      }
      return analyserRef.current.analyser;
    }
    try {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      const ctx = new Ctor();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyser.smoothingTimeConstant = 0.72;
      const src = ctx.createMediaElementSource(audioRef.current);
      src.connect(analyser);
      analyser.connect(ctx.destination);
      analyserRef.current = { ctx, analyser };
      ctx.resume().catch(() => {});
      return analyser;
    } catch {
      return null;
    }
  }, []);

  const getCurrentTime = useCallback(() => audioRef.current.currentTime, []);

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
  const [state, setState] = useState<PlayerState>({
    tracks: defaultTracks,
    currentTrackIndex: defaultTracks.length > 0 ? 0 : -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.75,
    isMuted: false,
  });

  // Point the audio element at a new source and start playing it.
  const startTrack = useCallback(async (audio: HTMLAudioElement, url: string) => {
    getAnalyser();
    expectedRawUrlRef.current = url;
    try {
      const playableUrl = await getPlayableUrl(url);
      // Only update if this is still the expected URL
      if (expectedRawUrlRef.current === url) {
        audio.src = playableUrl;
        audio.load();
        audio.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
      }
    } catch (error) {
      console.error("Failed to decode audio for playback:", error);
      // Fallback to raw URL if decoding fails
      if (expectedRawUrlRef.current === url) {
        audio.src = url;
        audio.load();
        audio.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
      }
    }
  }, [getAnalyser, getPlayableUrl]);

  useEffect(() => {
    nextRef.current = () => {
      setState((s) => {
        if (s.tracks.length === 0) return s;
        const nextIndex = (s.currentTrackIndex + 1) % s.tracks.length;
        const track = s.tracks[nextIndex];
        if (!track) return s;
        startTrack(audioRef.current, track.url);
        return { ...s, currentTrackIndex: nextIndex, currentTime: 0, duration: 0 };
      });
    };
  });

  useEffect(() => {
    const audio = audioRef.current;

    const onTimeUpdate = () =>
      setState((s) => ({ ...s, currentTime: audio.currentTime }));
    const onLoadedMetadata = () =>
      setState((s) => ({ ...s, duration: audio.duration }));
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
  }, []);

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
    getAnalyser();
    audioRef.current.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
  }, [getAnalyser]);

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
    setState((s) => ({ ...s, isPlaying: false }));
  }, [stopRangeMonitoring]);

  const togglePlay = useCallback(() => {
    setState((s) => {
      const audio = audioRef.current;
      if (s.isPlaying) {
        stopRangeMonitoring();
        audio.pause();
        return { ...s, isPlaying: false };
      }
      getAnalyser();
      audio.play().then(() => setState((prev) => ({ ...prev, isPlaying: true }))).catch(() => {});
      return s;
    });
  }, [getAnalyser, stopRangeMonitoring]);

  const next = useCallback(() => {
    nextRef.current();
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    setState((s) => {
      if (s.tracks.length === 0) return s;
      if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return { ...s, currentTime: 0 };
      }
      const prevIndex =
        (s.currentTrackIndex - 1 + s.tracks.length) % s.tracks.length;
      const track = s.tracks[prevIndex];
      if (!track) return s;
      startTrack(audio, track.url);
      return { ...s, currentTrackIndex: prevIndex, currentTime: 0, duration: 0 };
    });
  }, [startTrack]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio.paused) snatchToStart(audio, time);
    audio.currentTime = time;
    setState((s) => ({ ...s, currentTime: time }));
  }, []);

  const setVolume = useCallback((vol: number) => {
    audioRef.current.volume = vol;
    setState((s) => ({ ...s, volume: vol, isMuted: vol === 0 }));
  }, []);

  const toggleMute = useCallback(() => {
    setState((s) => {
      const newMuted = !s.isMuted;
      const audio = audioRef.current;
      audio.volume = newMuted ? 0 : s.volume;
      audio.muted = newMuted;
      return { ...s, isMuted: newMuted };
    });
  }, []);

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

      setState((s) => {
        const startIndex = s.tracks.length;
        const updated = { ...s, tracks: [...s.tracks, ...newTracks] };

        if (playAfter || s.currentTrackIndex === -1) {
          const track = newTracks[0];
          if (track) {
            setTimeout(() => startTrack(audioRef.current, track.url), 0);
            updated.currentTrackIndex = startIndex;
            updated.currentTime = 0;
            updated.duration = 0;
          }
        }

        return updated;
      });

      return { added: newTracks.length, skipped };
    },
    [startTrack],
  );

  const removeTrack = useCallback((index: number) => {
    setState((s) => {
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

      return { ...s, tracks: newTracks, currentTrackIndex: newIndex };
    });
  }, [startTrack]);

  const selectTrack = useCallback((index: number) => {
    setState((s) => {
      const audio = audioRef.current;
      const track = s.tracks[index];
      if (!track) return s;
      startTrack(audio, track.url);
      return { ...s, currentTrackIndex: index, currentTime: 0, duration: 0 };
    });
  }, [startTrack]);

  const skipForward = useCallback(() => {
    const audio = audioRef.current;
    const newTime = Math.min(audio.currentTime + skipSeconds, audio.duration || 0);
    audio.currentTime = newTime;
    setState((s) => ({ ...s, currentTime: newTime }));
  }, [skipSeconds]);

  const skipBackward = useCallback(() => {
    const audio = audioRef.current;
    const newTime = Math.max(audio.currentTime - skipSeconds, 0);
    audio.currentTime = newTime;
    setState((s) => ({ ...s, currentTime: newTime }));
  }, [skipSeconds]);

  // Plays the given time range [start, end] `repetitions` times sequentially,
  // pausing at `end` after the last repetition. Calls onComplete when finished.
  // Boundary detection runs on requestAnimationFrame (not the ~250ms
  // `timeupdate` cadence), so a clip stops within a frame of its end and
  // loops restart exactly at `start` instead of drifting.
  const playRange = useCallback((start: number, end: number, repetitions: number, onComplete?: () => void) => {
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
          setState((s) => ({ ...s, isPlaying: false, currentTime: end }));
          onComplete?.();
          return;
        }
        audio.currentTime = start;
        armedAtStart = true;
        setState((s) => ({ ...s, currentTime: start }));
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
        setState((s) => ({ ...s, isPlaying: false, currentTime: end }));
        onComplete?.();
        return;
      }
      audio.currentTime = start;
      armedAtStart = true;
      setState((s) => ({ ...s, currentTime: start }));
      audio.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
      rangeRafRef.current = requestAnimationFrame(tick);
    };

    rangeEndedRef.current = onEnded;
    audio.addEventListener("ended", onEnded);

    // Sync the playhead immediately; otherwise the wave keeps showing the old
    // position until the first event fires. Snap back to `start` when playback
    // actually begins so the opening is not skipped.
    snatchToStart(audio, start);
    audio.currentTime = start;
    setState((s) => ({ ...s, currentTime: start }));
    audio.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
    rangeRafRef.current = requestAnimationFrame(tick);
  }, [getAnalyser, stopRangeMonitoring]);

  return {
    state,
    play,
    pause,
    togglePlay,
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
    getAnalyser,
    getCurrentTime,
  };
}
