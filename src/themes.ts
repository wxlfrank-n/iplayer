/**
 * Theme and accent definitions.
 *
 * A "theme" is the full surface/text/border palette (light vs dark looks).
 * An "accent" is an independent color choice layered on top of any theme.
 * Together they drive the CSS custom properties consumed by App.css.
 */

export type ThemeId =
  | "dark"
  | "light"
  | "midnight"
  | "paper"
  | "rose"
  | "nova";
export type AccentId = "blue" | "violet" | "pink" | "orange" | "green" | "cyan";

export interface Theme {
  label: string;
  /** Hint for native controls (scrollbars, form widgets). */
  colorScheme: "light" | "dark";
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgPanel: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  border: string;
  danger: string;
  /** Waveform canvas background (vertical gradient endpoints). */
  waveformBgTop: string;
  waveformBgMid: string;
  /** Unplayed waveform bar color. */
  waveformBar: string;
  /** Silent (sub-peak) waveform bar color. */
  waveformBarSilent: string;
  /** Clip label badge background (translucent). */
  clipLabelBg: string;
  /** Clip label badge text. */
  clipLabelText: string;
  /** Clip label badge border. */
  clipLabelBorder: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  dark: {
    label: "Slate",
    colorScheme: "dark",
    bgPrimary: "#121417",
    bgSecondary: "#1a1d22",
    bgTertiary: "#22262c",
    bgHover: "#2b3038",
    bgPanel: "#16191e",
    textPrimary: "#e7eaee",
    textSecondary: "#9aa3ad",
    textTertiary: "#6a7480",
    border: "#2b3038",
    danger: "#ef5350",
    waveformBgTop: "#23272e",
    waveformBgMid: "#1c2026",
    waveformBar: "#8f96a0",
    waveformBarSilent: "#434a53",
    clipLabelBg: "rgba(22, 25, 30, 0.72)",
    clipLabelText: "#e7eaee",
    clipLabelBorder: "rgba(255, 255, 255, 0.16)",
  },
  light: {
    label: "Mist",
    colorScheme: "light",
    bgPrimary: "#f3f5f7",
    bgSecondary: "#ffffff",
    bgTertiary: "#ebedf0",
    bgHover: "#e0e3e8",
    bgPanel: "#f8f9fa",
    textPrimary: "#171c21",
    textSecondary: "#5a6370",
    textTertiary: "#8f98a6",
    border: "#d6dbe2",
    danger: "#d64545",
    waveformBgTop: "#e7eaee",
    waveformBgMid: "#dbe0e6",
    waveformBar: "#5b646e",
    waveformBarSilent: "#b2bac2",
    clipLabelBg: "rgba(255, 255, 255, 0.72)",
    clipLabelText: "#171c21",
    clipLabelBorder: "rgba(0, 0, 0, 0.10)",
  },
  midnight: {
    label: "Midnight",
    colorScheme: "dark",
    bgPrimary: "#0b2254",
    bgSecondary: "#10306b",
    bgTertiary: "#16397f",
    bgHover: "#1d4696",
    bgPanel: "#0d275d",
    textPrimary: "#d7e6ff",
    textSecondary: "#9db9ff",
    textTertiary: "#708fd3",
    border: "#24509f",
    danger: "#ff6b6b",
    waveformBgTop: "#14326e",
    waveformBgMid: "#0f2a5e",
    waveformBar: "#9db9ff",
    waveformBarSilent: "#2f4d86",
    clipLabelBg: "rgba(13, 39, 93, 0.72)",
    clipLabelText: "#d7e6ff",
    clipLabelBorder: "rgba(255, 255, 255, 0.18)",
  },
  paper: {
    label: "Sky",
    colorScheme: "light",
    bgPrimary: "#bdd7ff",
    bgSecondary: "#dbeaff",
    bgTertiary: "#adcdff",
    bgHover: "#9cc0fa",
    bgPanel: "#cfe4ff",
    textPrimary: "#0b2a66",
    textSecondary: "#2b54a8",
    textTertiary: "#6f8fd0",
    border: "#8fb4f0",
    danger: "#c1293e",
    waveformBgTop: "#cfe4ff",
    waveformBgMid: "#c4dcfd",
    waveformBar: "#1d4696",
    waveformBarSilent: "#8fb3ec",
    clipLabelBg: "rgba(235, 244, 255, 0.72)",
    clipLabelText: "#0b2a66",
    clipLabelBorder: "rgba(0, 0, 0, 0.08)",
  },
  nova: {
    label: "Nova",
    colorScheme: "dark",
    bgPrimary: "#261540",
    bgSecondary: "#321a52",
    bgTertiary: "#3e2166",
    bgHover: "#4e2a80",
    bgPanel: "#2b184a",
    textPrimary: "#f0e8ff",
    textSecondary: "#d0b9ff",
    textTertiary: "#a688dd",
    border: "#4e328a",
    danger: "#ff5c7a",
    waveformBgTop: "#381f60",
    waveformBgMid: "#2f1b54",
    waveformBar: "#d0b9ff",
    waveformBarSilent: "#5a4390",
    clipLabelBg: "rgba(43, 24, 74, 0.72)",
    clipLabelText: "#f0e8ff",
    clipLabelBorder: "rgba(255, 255, 255, 0.18)",
  },
  rose: {
    label: "Lilac",
    colorScheme: "light",
    bgPrimary: "#d9c8ff",
    bgSecondary: "#eadfff",
    bgTertiary: "#cdb8fa",
    bgHover: "#bfa8f4",
    bgPanel: "#e4d7fe",
    textPrimary: "#3a2390",
    textSecondary: "#5f46b3",
    textTertiary: "#9b8ad6",
    border: "#b7a0f4",
    danger: "#b23b74",
    waveformBgTop: "#e4d7fe",
    waveformBgMid: "#dcccfd",
    waveformBar: "#4a32a0",
    waveformBarSilent: "#b49dec",
    clipLabelBg: "rgba(245, 240, 255, 0.72)",
    clipLabelText: "#3a2390",
    clipLabelBorder: "rgba(0, 0, 0, 0.08)",
  },
};

export interface Accent {
  label: string;
  accent: string;
  accentDim: string;
  /** accent as "r, g, b" for rgba() tints. */
  rgb: string;
  /** accentDim as "r, g, b" for rgba() tints. */
  dimRgb: string;
}

export const ACCENTS: Record<AccentId, Accent> = {
  blue: {
    label: "Blue",
    accent: "#388bfd",
    accentDim: "#1f6feb",
    rgb: "56, 139, 253",
    dimRgb: "31, 111, 235",
  },
  violet: {
    label: "Violet",
    accent: "#a371f7",
    accentDim: "#8957e5",
    rgb: "163, 113, 247",
    dimRgb: "137, 87, 229",
  },
  pink: {
    label: "Pink",
    accent: "#f778ba",
    accentDim: "#db61a2",
    rgb: "247, 120, 186",
    dimRgb: "219, 97, 162",
  },
  orange: {
    label: "Orange",
    accent: "#f0883e",
    accentDim: "#d4621e",
    rgb: "240, 136, 62",
    dimRgb: "212, 98, 30",
  },
  green: {
    label: "Green",
    accent: "#4ac762",
    accentDim: "#238636",
    rgb: "74, 199, 98",
    dimRgb: "35, 134, 54",
  },
  cyan: {
    label: "Cyan",
    accent: "#39c5cf",
    accentDim: "#14919b",
    rgb: "57, 197, 207",
    dimRgb: "20, 145, 155",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];
export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

export const DEFAULT_THEME: ThemeId = "dark";
export const DEFAULT_ACCENT: AccentId = "blue";

/**
 * Applies the given theme + accent to the document root as inline CSS custom
 * properties, overriding the static `:root` fallbacks in App.css.
 */
export function applyThemeVars(theme: ThemeId, accent: AccentId): void {
  const t = THEMES[theme];
  const a = ACCENTS[accent];
  if (!t || !a) return;

  const root = document.documentElement;
  root.style.colorScheme = t.colorScheme;
  const vars: Array<[string, string]> = [
    ["--bg-primary", t.bgPrimary],
    ["--bg-secondary", t.bgSecondary],
    ["--bg-tertiary", t.bgTertiary],
    ["--bg-hover", t.bgHover],
    ["--bg-panel", t.bgPanel],
    ["--text-primary", t.textPrimary],
    ["--text-secondary", t.textSecondary],
    ["--text-tertiary", t.textTertiary],
    ["--border", t.border],
    ["--danger", t.danger],
    ["--waveform-bg-top", t.waveformBgTop],
    ["--waveform-bg-mid", t.waveformBgMid],
    ["--waveform-bar", t.waveformBar],
    ["--waveform-bar-silent", t.waveformBarSilent],
    ["--clip-label-bg", t.clipLabelBg],
    ["--clip-label-text", t.clipLabelText],
    ["--clip-label-border", t.clipLabelBorder],
    ["--accent", a.accent],
    ["--accent-dim", a.accentDim],
    ["--accent-rgb", a.rgb],
    ["--accent-dim-rgb", a.dimRgb],
  ];
  for (const [key, value] of vars) {
    root.style.setProperty(key, value);
  }
}