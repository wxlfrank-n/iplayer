/**
 * Redux slice for player configuration.
 *
 * Persisted settings (auto-saved to localStorage under Listeenoop_config):
 * - skipSeconds: Skip duration for forward/backward buttons (default: 10s)
 * - waveformView: Waveform display mode ("stacked" or "horizontal")
 * - blockMs: Silence-detection block size in milliseconds (default: 12)
 * - silenceRatio: Silence cutoff as a ratio of the track peak (default: 0.01)
 * - minSilenceLength: Shortest acceptable clip in seconds (default: 0.05).
 *   Independent of silenceRatio — it caps how short a merged clip can be, not
 *   how quiet a block must be to count as silence.
 * - minClipLength: Shortest clip to keep after silence splitting (default: 0.3).
 *   Clips shorter than this are folded into a neighbor when the gap is small.
 *
 * Changes persist to localStorage immediately.
 */

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { WaveformView } from "../types";

const STORAGE_KEY = "Listeenoop_config";

interface ConfigState {
  skipSeconds: number;
  waveformView: WaveformView;
  blockMs: number;
  silenceRatio: number;
  minSilenceLength: number;
  minClipLength: number;
}

export const DEFAULT_CONFIG: ConfigState = {
  skipSeconds: 10,
  waveformView: "stacked",
  blockMs: 12,
  silenceRatio: 0.01,
  minSilenceLength: 0.05,
  minClipLength: 0.3,
};

/** Valid numeric ranges for each configurable value (drives the Settings UI). */
export const CONFIG_RANGES = {
  skipSeconds: { min: 1, max: 60 },
  blockMs: { min: 2, max: 64 },
  silenceRatio: { min: 0.005, max: 0.1 },
  minSilenceLength: { min: 0.1, max: 0.5 },
  minClipLength: { min: 0.2, max: 1 },
} as const;

function loadConfig(): ConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_CONFIG, ...parsed };
    }
  } catch {}
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config: ConfigState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
}

const initialState: ConfigState = loadConfig();

export const configSlice = createSlice({
  name: "config",
  initialState,
  reducers: {
    updateConfig(state, action: PayloadAction<Partial<ConfigState>>) {
      const next = { ...state, ...action.payload };
      saveConfig(next);
      return next;
    },
  },
});

export const { updateConfig } = configSlice.actions;
export default configSlice.reducer;
