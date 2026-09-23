/**
 * Theme definitions.
 *
 * A "theme" is the full surface/text/border palette (light vs dark looks) plus
 * the accent color tuned for that palette. Together they drive the CSS custom
 * properties consumed by App.css. Each theme ships its own accent: on dark
 * surfaces the accent is lifted brighter for glow/contrast, on light surfaces
 * it is deepened so interactive elements stay readable.
 */

export type ThemeId =
  | "dark"
  | "light"
  | "midnight"
  | "paper"
  | "rose"
  | "nova";

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
  /** Accent color tuned for this theme. */
  accent: string;
  /** Slightly deeper/muted accent for borders and pressed states. */
  accentDim: string;
  /** Accent as "r, g, b" for rgba() tints. */
  accentRgb: string;
  /** accentDim as "r, g, b" for rgba() tints. */
  accentDimRgb: string;
  /** Clip swipe hint icon color (pack/unpack affordance on the active clip). */
  clipSwipe: string;
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
    accent: "#58a6ff",
    accentDim: "#388bfd",
    accentRgb: "88, 166, 255",
    accentDimRgb: "56, 139, 253",
    clipSwipe: "#58a6ff",
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
    accent: "#2f80ed",
    accentDim: "#1c64d6",
    accentRgb: "47, 128, 237",
    accentDimRgb: "28, 100, 214",
    clipSwipe: "#1c64d6",
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
    accent: "#4ad1dc",
    accentDim: "#1ea1ad",
    accentRgb: "74, 209, 220",
    accentDimRgb: "30, 161, 173",
    clipSwipe: "#4ad1dc",
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
    accent: "#2b74d8",
    accentDim: "#1a5cb8",
    accentRgb: "43, 116, 216",
    accentDimRgb: "26, 92, 184",
    clipSwipe: "#1a5cb8",
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
    accent: "#b18cff",
    accentDim: "#9366f2",
    accentRgb: "177, 140, 255",
    accentDimRgb: "147, 102, 242",
    clipSwipe: "#b18cff",
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
    accent: "#7a52d6",
    accentDim: "#5f3cbf",
    accentRgb: "122, 82, 214",
    accentDimRgb: "95, 60, 191",
    clipSwipe: "#5f3cbf",
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const DEFAULT_THEME: ThemeId = "dark";

/**
 * Applies the given theme to the document root as inline CSS custom
 * properties, overriding the static `:root` fallbacks in App.css.
 */
export function applyThemeVars(theme: ThemeId): void {
  const t = THEMES[theme];
  if (!t) return;

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
    ["--accent", t.accent],
    ["--accent-dim", t.accentDim],
    ["--accent-rgb", t.accentRgb],
    ["--accent-dim-rgb", t.accentDimRgb],
    ["--clip-swipe", t.clipSwipe],
  ];
  for (const [key, value] of vars) {
    root.style.setProperty(key, value);
  }
}