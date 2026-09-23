/**
 * Shared selectors for the app store.
 *
 * Components read player/analysis/config state through these so the shapes of
 * the slices stay encapsulated. `selectCurrentAudio` assembles the consolidated
 * "current audio" record used by the waveform and clip views.
 */

import type { RootState } from "./store";
import type { CurrentAudio } from "../types";

// ---- config ----
export const selectSkipSeconds = (s: RootState) => s.config.skipSeconds;
export const selectWaveformView = (s: RootState) => s.config.waveformView;
/** How many times a clicked clip is repeated. */
export const selectRepetitions = (s: RootState) => s.config.repetitions ?? 3;
/** Whether the clip toolbar (merge gap + repeats) is visible. */
export const selectShowAdvancedControls = (s: RootState) =>
  s.config.showAdvancedControls ?? true;
/**
 * Shortest acceptable clip in seconds, independent of `silenceRatio`. Seeds the
 * merge slider's smallest step; ProgressBar uses it to drive its own merge gap
 * (the slider behaviour, not the split cutoff which stays silenceRatio-driven).
 */
export const selectminSilenceLength = (s: RootState) =>
  s.config.minSilenceLength ?? 0.1;
/**
 * Shortest clip to keep after silence splitting, in seconds. Clips shorter
 * than this are folded into a neighbor when the separating gap is small.
 */
export const selectminClipLength = (s: RootState) =>
  s.config.minClipLength ?? 0.3;

// ---- player ----
export const selectTracks = (s: RootState) => s.player.tracks;
export const selectCurrentTrackIndex = (s: RootState) =>
  s.player.currentTrackIndex;
export const selectIsPlaying = (s: RootState) => s.player.isPlaying;

export const selectCurrentTrack = (s: RootState) => {
  const t = s.player.tracks[s.player.currentTrackIndex];
  return t ?? null;
};

export const selectCanPlay = (s: RootState) => s.player.tracks.length > 0;

export function selectCurrentAudio(s: RootState): CurrentAudio {
  const track = selectCurrentTrack(s);
  return {
    url: track?.url ?? null,
    title: track?.title ?? null,
    waveform:
      s.analysis.waveformStatus === "ready" ? s.analysis.waveform : null,
    waveformStatus: s.analysis.waveformStatus,
    clips: s.analysis.clips,
    currentTime: s.player.currentTime,
    activeClip: s.analysis.activeClip,
  };
}
