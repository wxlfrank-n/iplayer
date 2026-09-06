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
    url: `/music/${t.filename}`,
    file: undefined,
  }));

  const audioRef = useRef<HTMLAudioElement>(new Audio());
  const nextRef = useRef<() => void>(() => {});
  const expectedRawUrlRef = useRef<string | null>(null);
  const wavBlobCacheRef = useRef<Map<string, string>>(new Map());

  const getPlayableUrl = useCallback(async (url: string): Promise<string> => {
    const cache = wavBlobCacheRef.current;
    const cached = cache.get(url);
    if (cached) return cached;

    const buffer = await decodeAudioBuffer(url);
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
  }, [getPlayableUrl]);

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
    audioRef.current.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
  }, []);

  const pause = useCallback(() => {
    audioRef.current.pause();
    setState((s) => ({ ...s, isPlaying: false }));
  }, []);

  const togglePlay = useCallback(() => {
    setState((s) => {
      const audio = audioRef.current;
      if (s.isPlaying) {
        audio.pause();
        return { ...s, isPlaying: false };
      }
      audio.play().then(() => setState((prev) => ({ ...prev, isPlaying: true }))).catch(() => {});
      return s;
    });
  }, []);

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
  const playRange = useCallback((start: number, end: number, repetitions: number, onComplete?: () => void) => {
    const audio = audioRef.current;
    let count = 0;

    const onTimeUpdate = () => {
      if (audio.currentTime < start) return;
      if (audio.currentTime >= end) {
        count++;
        if (count >= repetitions) {
          audio.pause();
          audio.removeEventListener("timeupdate", onTimeUpdate);
          onComplete?.();
          return;
        }
        setTimeout(() => { audio.currentTime = start; }, 0);
      }
    };

    audio.addEventListener("timeupdate", onTimeUpdate);
    // Sync the playhead immediately; otherwise the wave keeps showing the old
    // position until the first timeupdate fires (~250ms later). Snap back to
    // `start` when playback actually begins so the opening is not skipped.
    snatchToStart(audio, start);
    audio.currentTime = start;
    setState((s) => ({ ...s, currentTime: start }));
    audio.play().then(() => setState((s) => ({ ...s, isPlaying: true }))).catch(() => {});
  }, []);

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
  };
}
