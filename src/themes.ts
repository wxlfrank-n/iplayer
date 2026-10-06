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
  | 'dark'
  | 'light'
  | 'midnight'
  | 'paper'
  | 'rose'
  | 'nova'
  | 'qinghua'
  | 'zhusha'
  | 'yingluo'
  | 'norge';

export interface Theme {
  label: string;
  /** Hint for native controls (scrollbars, form widgets). */
  colorScheme: 'light' | 'dark';
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
  /** Waveform bar color for the played portion. */
  waveformBarPlayed: string;
}

export const THEMES: Record<ThemeId, Theme> = {
  dark: {
    label: 'Slate',
    colorScheme: 'dark',
    bgPrimary: '#121417',
    bgSecondary: '#1a1d22',
    bgTertiary: '#22262c',
    bgHover: '#2b3038',
    bgPanel: '#16191e',
    textPrimary: '#e7eaee',
    textSecondary: '#9aa3ad',
    textTertiary: '#6a7480',
    border: '#2b3038',
    danger: '#ef5350',
    waveformBgTop: '#23272e',
    waveformBgMid: '#1c2026',
    waveformBar: '#5a6b8a',
    waveformBarSilent: '#434a53',
    waveformBarPlayed: '#58a6ff',
    clipLabelBg: 'rgba(22, 25, 30, 0.72)',
    clipLabelText: '#e7eaee',
    clipLabelBorder: 'rgba(255, 255, 255, 0.16)',
    accent: '#58a6ff',
    accentDim: '#388bfd',
    accentRgb: '88, 166, 255',
    accentDimRgb: '56, 139, 253',
    clipSwipe: '#58a6ff',
  },
  light: {
    label: 'Mist',
    colorScheme: 'light',
    bgPrimary: '#f3f5f7',
    bgSecondary: '#ffffff',
    bgTertiary: '#ebedf0',
    bgHover: '#e0e3e8',
    bgPanel: '#f8f9fa',
    textPrimary: '#171c21',
    textSecondary: '#5a6370',
    textTertiary: '#8f98a6',
    border: '#d6dbe2',
    danger: '#d64545',
    waveformBgTop: '#e7eaee',
    waveformBgMid: '#dbe0e6',
    waveformBar: '#8a94b8',
    waveformBarSilent: '#b2bac2',
    waveformBarPlayed: '#2f80ed',
    clipLabelBg: 'rgba(255, 255, 255, 0.72)',
    clipLabelText: '#171c21',
    clipLabelBorder: 'rgba(0, 0, 0, 0.10)',
    accent: '#2f80ed',
    accentDim: '#1c64d6',
    accentRgb: '47, 128, 237',
    accentDimRgb: '28, 100, 214',
    clipSwipe: '#1c64d6',
  },
  midnight: {
    label: 'Midnight',
    colorScheme: 'dark',
    bgPrimary: '#0b2254',
    bgSecondary: '#10306b',
    bgTertiary: '#16397f',
    bgHover: '#1d4696',
    bgPanel: '#0d275d',
    textPrimary: '#d7e6ff',
    textSecondary: '#9db9ff',
    textTertiary: '#708fd3',
    border: '#24509f',
    danger: '#ff6b6b',
    waveformBgTop: '#14326e',
    waveformBgMid: '#0f2a5e',
    waveformBar: '#5a7fc8',
    waveformBarSilent: '#2f4d86',
    waveformBarPlayed: '#4ad1dc',
    clipLabelBg: 'rgba(13, 39, 93, 0.72)',
    clipLabelText: '#d7e6ff',
    clipLabelBorder: 'rgba(255, 255, 255, 0.18)',
    accent: '#4ad1dc',
    accentDim: '#1ea1ad',
    accentRgb: '74, 209, 220',
    accentDimRgb: '30, 161, 173',
    clipSwipe: '#4ad1dc',
  },
  paper: {
    label: 'Sky',
    colorScheme: 'light',
    bgPrimary: '#bdd7ff',
    bgSecondary: '#dbeaff',
    bgTertiary: '#adcdff',
    bgHover: '#9cc0fa',
    bgPanel: '#cfe4ff',
    textPrimary: '#0b2a66',
    textSecondary: '#2b54a8',
    textTertiary: '#6f8fd0',
    border: '#8fb4f0',
    danger: '#c1293e',
    waveformBgTop: '#cfe4ff',
    waveformBgMid: '#c4dcfd',
    waveformBar: '#6a9bd8',
    waveformBarSilent: '#8fb3ec',
    waveformBarPlayed: '#2b74d8',
    clipLabelBg: 'rgba(235, 244, 255, 0.72)',
    clipLabelText: '#0b2a66',
    clipLabelBorder: 'rgba(0, 0, 0, 0.08)',
    accent: '#2b74d8',
    accentDim: '#1a5cb8',
    accentRgb: '43, 116, 216',
    accentDimRgb: '26, 92, 184',
    clipSwipe: '#1a5cb8',
  },
  nova: {
    label: 'Nova',
    colorScheme: 'dark',
    bgPrimary: '#261540',
    bgSecondary: '#321a52',
    bgTertiary: '#3e2166',
    bgHover: '#4e2a80',
    bgPanel: '#2b184a',
    textPrimary: '#f0e8ff',
    textSecondary: '#d0b9ff',
    textTertiary: '#a688dd',
    border: '#4e328a',
    danger: '#ff5c7a',
    waveformBgTop: '#381f60',
    waveformBgMid: '#2f1b54',
    waveformBar: '#8a7bd8',
    waveformBarSilent: '#5a4390',
    waveformBarPlayed: '#b18cff',
    clipLabelBg: 'rgba(43, 24, 74, 0.72)',
    clipLabelText: '#f0e8ff',
    clipLabelBorder: 'rgba(255, 255, 255, 0.18)',
    accent: '#b18cff',
    accentDim: '#9366f2',
    accentRgb: '177, 140, 255',
    accentDimRgb: '147, 102, 242',
    clipSwipe: '#b18cff',
  },
  rose: {
    label: 'Lilac',
    colorScheme: 'light',
    bgPrimary: '#d9c8ff',
    bgSecondary: '#eadfff',
    bgTertiary: '#cdb8fa',
    bgHover: '#bfa8f4',
    bgPanel: '#e4d7fe',
    textPrimary: '#3a2390',
    textSecondary: '#5f46b3',
    textTertiary: '#9b8ad6',
    border: '#b7a0f4',
    danger: '#b23b74',
    waveformBgTop: '#e4d7fe',
    waveformBgMid: '#dcccfd',
    waveformBar: '#8a7bd8',
    waveformBarSilent: '#b49dec',
    waveformBarPlayed: '#7a52d6',
    clipLabelBg: 'rgba(245, 240, 255, 0.72)',
    clipLabelText: '#3a2390',
    clipLabelBorder: 'rgba(0, 0, 0, 0.08)',
    accent: '#7a52d6',
    accentDim: '#5f3cbf',
    accentRgb: '122, 82, 214',
    accentDimRgb: '95, 60, 191',
    clipSwipe: '#5f3cbf',
  },

  qinghua: {
    label: 'Qinghua',
    colorScheme: 'light',
    bgPrimary: '#ffffff',
    bgSecondary: '#f8faff',
    bgTertiary: '#e8f0fe',
    bgHover: '#d0e0fd',
    bgPanel: '#fafcff',
    textPrimary: '#001d4a',
    textSecondary: '#003080',
    textTertiary: '#4a6fc8',
    border: '#8ab4f8',
    danger: '#b00020',
    waveformBgTop: '#f0f5ff',
    waveformBgMid: '#e0eaff',
    waveformBar: '#6a9ce0',
    waveformBarSilent: '#7a9ce0',
    waveformBarPlayed: '#0038a8',
    clipLabelBg: 'rgba(255, 255, 255, 0.85)',
    clipLabelText: '#001d4a',
    clipLabelBorder: 'rgba(0, 29, 74, 0.18)',
    accent: '#0038a8',
    accentDim: '#002878',
    accentRgb: '0, 56, 168',
    accentDimRgb: '0, 40, 120',
    clipSwipe: '#0038a8',
  },

  zhusha: {
    label: 'Zhusha',
    colorScheme: 'dark',
    bgPrimary: '#0d0d0d',
    bgSecondary: '#1a0a0a',
    bgTertiary: '#2d1212',
    bgHover: '#3d1818',
    bgPanel: '#140808',
    textPrimary: '#fff0f0',
    textSecondary: '#ffcccc',
    textTertiary: '#ff9999',
    border: '#ff4444',
    danger: '#ff3333',
    waveformBgTop: '#1a0a0a',
    waveformBgMid: '#0d0505',
    waveformBar: '#8a3333',
    waveformBarSilent: '#802222',
    waveformBarPlayed: '#e60012',
    clipLabelBg: 'rgba(20, 8, 8, 0.85)',
    clipLabelText: '#fff0f0',
    clipLabelBorder: 'rgba(255, 68, 68, 0.25)',
    accent: '#e60012',
    accentDim: '#b8000e',
    accentRgb: '230, 0, 18',
    accentDimRgb: '184, 0, 14',
    clipSwipe: '#e60012',
  },

  yingluo: {
    label: 'Yingluo',
    colorScheme: 'light',
    bgPrimary: '#fff8f0',
    bgSecondary: '#fffef8',
    bgTertiary: '#ffe8e0',
    bgHover: '#ffd8cc',
    bgPanel: '#fffaf5',
    textPrimary: '#4a0d1a',
    textSecondary: '#801830',
    textTertiary: '#c86a80',
    border: '#ffb3cc',
    danger: '#8b002a',
    waveformBgTop: '#fff0e8',
    waveformBgMid: '#ffe0d0',
    waveformBar: '#c775a0',
    waveformBarSilent: '#e08ab8',
    waveformBarPlayed: '#c71585',
    clipLabelBg: 'rgba(255, 248, 240, 0.85)',
    clipLabelText: '#4a0d1a',
    clipLabelBorder: 'rgba(74, 13, 26, 0.18)',
    accent: '#c71585',
    accentDim: '#a01068',
    accentRgb: '199, 21, 133',
    accentDimRgb: '160, 16, 104',
    clipSwipe: '#c71585',
  },

  norge: {
    label: 'Norge',
    colorScheme: 'light',
    bgPrimary: '#ffffff',
    bgSecondary: '#f0f4f8',
    bgTertiary: '#dce8f4',
    bgHover: '#c8d8f0',
    bgPanel: '#f8faff',
    textPrimary: '#002868',
    textSecondary: '#003878',
    textTertiary: '#4a78a8',
    border: '#ba0c2f',
    danger: '#ba0c2f',
    waveformBgTop: '#f0f4f8',
    waveformBgMid: '#e0e8f0',
    // Flag split: unplayed bars in vivid flag blue, played in flag red.
    waveformBar: '#0057b8',
    waveformBarSilent: '#4a94e0',
    waveformBarPlayed: '#ba0c2f',
    clipLabelBg: 'rgba(255, 255, 255, 0.9)',
    clipLabelText: '#002868',
    clipLabelBorder: 'rgba(186, 12, 47, 0.22)',
    accent: '#ba0c2f',
    accentDim: '#960925',
    accentRgb: '186, 12, 47',
    accentDimRgb: '150, 9, 37',
    clipSwipe: '#ba0c2f',
  },
};

export const THEME_IDS = Object.keys(THEMES) as ThemeId[];

export const DEFAULT_THEME: ThemeId = 'dark';

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
    ['--bg-primary', t.bgPrimary],
    ['--bg-secondary', t.bgSecondary],
    ['--bg-tertiary', t.bgTertiary],
    ['--bg-hover', t.bgHover],
    ['--bg-panel', t.bgPanel],
    ['--text-primary', t.textPrimary],
    ['--text-secondary', t.textSecondary],
    ['--text-tertiary', t.textTertiary],
    ['--border', t.border],
    ['--danger', t.danger],
    ['--waveform-bg-top', t.waveformBgTop],
    ['--waveform-bg-mid', t.waveformBgMid],
    ['--waveform-bar', t.waveformBar],
    ['--waveform-bar-silent', t.waveformBarSilent],
    ['--waveform-bar-played', t.waveformBarPlayed],
    ['--clip-label-bg', t.clipLabelBg],
    ['--clip-label-text', t.clipLabelText],
    ['--clip-label-border', t.clipLabelBorder],
    ['--accent', t.accent],
    ['--accent-dim', t.accentDim],
    ['--accent-rgb', t.accentRgb],
    ['--accent-dim-rgb', t.accentDimRgb],
    ['--clip-swipe', t.clipSwipe],
  ];
  for (const [key, value] of vars) {
    root.style.setProperty(key, value);
  }
}
