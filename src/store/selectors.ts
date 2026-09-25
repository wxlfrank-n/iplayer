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

// ---- player ----
export const selectTracks = (s: RootState) => s.player.tracks;
export const selectCurrentTrackIndex = (s: RootState) =>
  s.player.currentTrackIndex;
export const selectIsPlaying = (s: RootState) => s.player.isPlaying;
export const selectCurrentTime = (s: RootState) => s.player.currentTime;
export const selectDuration = (s: RootState) => s.player.duration;

export const selectCurrentTrack = (s: RootState) => {
  const t = s.player.tracks[s.player.currentTrackIndex];
  return t ?? null;
};

export const selectCanPlay = (s: RootState) => s.player.tracks.length > 0;

// ---- analysis ----
/** Detected silent-gap lengths the merge slider snaps to, ascending. */
export const selectGaps = (s: RootState) => s.analysis.gaps;

export interface CurrentAudioInput {
  track: ReturnType<typeof selectCurrentTrack> | null;
  waveform: RootState["analysis"]["waveform"];
  waveformStatus: RootState["analysis"]["waveformStatus"];
  clips: RootState["analysis"]["clips"];
  gaps: RootState["analysis"]["gaps"];
  minGap: RootState["analysis"]["minGap"];
  currentTime: RootState["player"]["currentTime"];
  activeClip: RootState["analysis"]["activeClip"];
}

export function toCurrentAudio({
  track,
  waveform,
  waveformStatus,
  clips,
  gaps,
  minGap,
  currentTime,
  activeClip,
}: CurrentAudioInput): CurrentAudio {
  return {
    url: track?.url ?? null,
    title: track?.title ?? null,
    waveform: waveformStatus === "ready" ? waveform : null,
    waveformStatus,
    clips,
    gaps,
    minGap,
    currentTime,
    activeClip,
  };
}

export function selectCurrentAudio(s: RootState): CurrentAudio {
  const track = selectCurrentTrack(s);
  return toCurrentAudio({
    track,
    waveform: s.analysis.waveform,
    waveformStatus: s.analysis.waveformStatus,
    clips: s.analysis.clips,
    gaps: s.analysis.gaps,
    minGap: s.analysis.minGap,
    currentTime: s.player.currentTime,
    activeClip: s.analysis.activeClip,
  });
}
