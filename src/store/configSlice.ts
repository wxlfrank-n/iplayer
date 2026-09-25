/**
 * Redux slice for player configuration.
 *
 * Persisted settings (auto-saved to localStorage under Listeenoop_config):
 * - skipSeconds: Skip duration for forward/backward buttons (default: 10s)
 * - waveformView: Waveform display mode ("stacked" or "horizontal")
 * - blockMs: Silence-detection block size in milliseconds (default: 12)
 * - silenceRatio: Silence cutoff as a ratio of the track peak (default: 0.01)
 * - minClipLength: Shortest clip to keep after silence splitting (default: 0.3).
 *   Clips shorter than this are folded into a neighbor when the gap is small.
 * - repetitions: How many times a clicked clip is repeated (default: 3).
 * - showAdvancedControls: Whether the clip toolbar (merge gap + repeat
 *   controls) is shown above the waveform (default: true).
 * - theme: Appearance palette (dark/light/midnight/paper/rose/nova). Each theme
 *   carries its own accent color, so there is no separate accent setting.
 *
 * Changes persist to localStorage immediately.
 */

import { createSlice } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
import type { WaveformView } from "../types";
import type { ThemeId } from "../themes";
import { DEFAULT_THEME, THEME_IDS } from "../themes";

const STORAGE_KEY = "Listeenoop_config";

interface ConfigState {
  skipSeconds: number;
  waveformView: WaveformView;
  blockMs: number;
  silenceRatio: number;
  minClipLength: number;
  repetitions: number;
  showAdvancedControls: boolean;
  theme: ThemeId;
}

export const DEFAULT_CONFIG: ConfigState = {
  skipSeconds: 10,
  waveformView: "stacked",
  blockMs: 12,
  silenceRatio: 0.01,
  minClipLength: 0.3,
  repetitions: 3,
  showAdvancedControls: false,
  theme: DEFAULT_THEME,
};

/** Valid numeric ranges for each configurable value (drives the Settings UI). */
export const CONFIG_RANGES = {
  skipSeconds: { min: 1, max: 60 },
  blockMs: { min: 2, max: 64 },
  silenceRatio: { min: 0.005, max: 0.1 },
  minClipLength: { min: 0.2, max: 1 },
  repetitions: { min: 1, max: 20 },
} as const;

function loadConfig(): ConfigState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        ...DEFAULT_CONFIG,
        ...parsed,
        theme: THEME_IDS.includes(parsed.theme) ? parsed.theme : DEFAULT_THEME,
        repetitions: Number.isFinite(parsed.repetitions)
          ? Math.min(
              CONFIG_RANGES.repetitions.max,
              Math.max(CONFIG_RANGES.repetitions.min, Math.round(parsed.repetitions)),
            )
          : DEFAULT_CONFIG.repetitions,
        showAdvancedControls:
          typeof parsed.showAdvancedControls === "boolean"
            ? parsed.showAdvancedControls
            : DEFAULT_CONFIG.showAdvancedControls,
      };
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
