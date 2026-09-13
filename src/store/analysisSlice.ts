/**
 * Redux slice for decoded/analyzed audio of the current track.
 *
 * A side-effect hook (`useWaveform`) decodes the current track's samples and
 * stores them here; `App` derives silence-split clips from that waveform and
 * stores them too. Kept separate from `player` so decode/analysis can update at
 * its own cadence without churning playback state.
 */

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { WaveformData, WaveformStatus } from "../types";
import type { Clip } from "../utils/clips";

export interface AnalysisState {
  waveform: WaveformData | null;
  waveformStatus: WaveformStatus;
  clips: Clip[];
  activeClip: number;
}

const initialState: AnalysisState = {
  waveform: null,
  waveformStatus: "idle",
  clips: [],
  activeClip: -1,
};

export const analysisSlice = createSlice({
  name: "analysis",
  initialState,
  reducers: {
    setWaveform(state, action: PayloadAction<WaveformData | null>) {
      state.waveform = action.payload;
    },
    setWaveformStatus(state, action: PayloadAction<WaveformStatus>) {
      state.waveformStatus = action.payload;
    },
    setClips(state, action: PayloadAction<Clip[]>) {
      state.clips = action.payload;
    },
    setActiveClip(state, action: PayloadAction<number>) {
      state.activeClip = action.payload;
    },
  },
});

export const { setWaveform, setWaveformStatus, setClips, setActiveClip } =
  analysisSlice.actions;
export default analysisSlice.reducer;
