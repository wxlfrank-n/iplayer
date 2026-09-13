/**
 * Redux slice for player configuration.
 *
 * Persisted settings:
 * - skipSeconds: Skip duration for forward/backward buttons (default: 10s)
 * - waveformView: Display mode for waveform ("stacked" or "horizontal")
 *
 * Changes are automatically saved to localStorage.
 */

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { WaveformView } from "../types";

const STORAGE_KEY = "Listeenoop_config";

interface ConfigState {
  skipSeconds: number;
  waveformView: WaveformView;
}

const DEFAULT_CONFIG: ConfigState = {
  skipSeconds: 10,
  waveformView: "stacked",
};

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
