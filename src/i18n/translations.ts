/**
 * Translation strings (i18n).
 *
 * English is the source of truth and ships as the default locale, so the app
 * works without a provider and every dictionary is forced to stay complete.
 * Add new locales by appending a `{ ...en }`-shaped object to `dictionaries`.
 */

export const en = {
  common: {
    close: "Close",
  },

  player: {
    play: "Play",
    pause: "Pause",
    backToStart: "Go to start",
    skipToEnd: "Go to end",
    backSeconds: "Go back {seconds} seconds",
    forwardSeconds: "Go forward {seconds} seconds",
    backSecondsShort: "Back {seconds}s",
    forwardSecondsShort: "Forward {seconds}s",
  },

  actions: {
    playlist: "Playlist",
    settings: "Settings",
    more: "More",
  },

  nowPlaying: {
    noTrack: "No track selected",
    addMusic: "Add an MP3 file to get started",
    mono: "Mono",
    stereo: "Stereo",
  },

  playlist: {
    title: "Playlist ({count})",
    addTracks: "Add tracks",
    close: "Close playlist",
  },

  trackList: {
    empty: "No tracks yet",
    hint: "Drop MP3 files here or use the button above",
    removeTrack: "Remove track",
  },

  emptyState: {
    title: "Add an MP3 file to get started",
    subtitle: "Drop MP3 files anywhere in this window, or choose them from your device.",
    addFiles: "Add MP3 files",
  },

  reps: {
    title: "Number of times a clip repeats when you click it",
    label: "Repeats:",
    decrease: "Decrease repeats",
    decreaseHint: "Repeat each clip fewer times",
    increase: "Increase repeats",
    increaseHint: "Repeat each clip more times",
  },

  merge: {
    increaseGap: "Merge more clips",
    increaseHint: "Allow longer pauses between clips",
    decreaseGap: "Merge fewer clips",
    decreaseHint: "Only merge clips with shorter pauses",
    bubbleTitle: "Clips with pauses shorter than this are joined together",
    rangeTitle: "Clips less than {gap}s apart are joined together",
    clipCount: "{count} clip",
    clipCountPlural: "{count} clips",
  },

  clipLabel: {
    split: "Split clip",
    merge: "Join with nearby clip",
  },

  viewFlip: {
    toStacked: "Switch to stacked view",
    toSingle: "Switch to single-row view",
    stacked: "Stacked view",
    single: "Single-row view",
  },

  settings: {
    title: "Settings",
    close: "Close settings",
    sectionsLabel: "Settings sections",

    tabAppearance: "Appearance",
    tabPlayback: "Playback",
    tabClips: "Clip detection",

    theme: "Theme",
    language: "Language",

    waveformView: "Waveform view",
    singleRow: "Single row",
    stacked: "Stacked",
    singleRowHint: "Show the waveform in one scrollable row that follows playback.",

    skipBy: "Skip forward or back by",

    repeatsPerClip: "Repeats per clip",
    repeatsHint: "Choose how many times a clip repeats when you click it.",

    showAdvanced: "Show advanced controls",
    showAdvancedHint: "Show quick controls for merging clips and changing repeats below the waveform.",

    silenceThreshold: "Silence sensitivity",
    silenceHint: "Controls how quiet the audio needs to be before it is treated as a pause. Lower values detect only quieter pauses.",

    analysisDetail: "Detection precision",
    analysisHint: "Smaller values find more precise split points but may take slightly longer to process.",

    minClipLength: "Minimum clip length",
    minClipLengthHint: "Clips shorter than this are automatically joined with a nearby clip.",

    resetAll: "Reset all settings",
    changesLive: "Changes apply instantly and are saved automatically",
  },

  themes: {
    dark: "Slate",
    light: "Mist",
    midnight: "Midnight",
    paper: "Sky",
    nova: "Nova",
    rose: "Lilac",
  },

  app: {
    skippedNonMp3: "Skipped {count} file because only MP3 files are supported.",
    skippedNonMp3Plural: "Skipped {count} files because only MP3 files are supported.",
  },

  errorBoundary: {
    crashed: "Something went wrong",
  },
};

export const zh: Messages = {
  common: {
    close: "关闭",
  },

  player: {
    play: "播放",
    pause: "暂停",
    backToStart: "回到开头",
    skipToEnd: "跳到结尾",
    backSeconds: "后退 {seconds} 秒",
    forwardSeconds: "前进 {seconds} 秒",
    backSecondsShort: "后退 {seconds}秒",
    forwardSecondsShort: "前进 {seconds}秒",
  },

  actions: {
    playlist: "播放列表",
    settings: "设置",
    more: "更多",
  },

  nowPlaying: {
    noTrack: "未选择音频",
    addMusic: "添加 MP3 文件开始使用",
    mono: "单声道",
    stereo: "立体声",
  },

  playlist: {
    title: "播放列表（{count}）",
    addTracks: "添加音频",
    close: "关闭播放列表",
  },

  trackList: {
    empty: "还没有添加音频",
    hint: "将 MP3 文件拖到这里，或使用下方按钮添加",
    removeTrack: "移除音频",
  },

  emptyState: {
    title: "添加 MP3 文件开始使用",
    subtitle: "将 MP3 文件拖到窗口中的任意位置，或从设备中选择文件。",
    addFiles: "添加 MP3 文件",
  },

  reps: {
    title: "点击片段后重复播放的次数",
    label: "重复次数：",
    decrease: "减少重复次数",
    decreaseHint: "减少每个片段的重复播放次数",
    increase: "增加重复次数",
    increaseHint: "增加每个片段的重复播放次数",
  },

  merge: {
    increaseGap: "合并更多片段",
    increaseHint: "允许片段之间有更长的停顿",
    decreaseGap: "减少片段合并",
    decreaseHint: "只合并停顿较短的片段",
    bubbleTitle: "停顿时间短于此值的片段将自动合并",
    rangeTitle: "间隔少于 {gap} 秒的片段将自动合并",
    clipCount: "{count} 个片段",
    clipCountPlural: "{count} 个片段",
  },

  clipLabel: {
    split: "拆分片段",
    merge: "与相邻片段合并",
  },

  viewFlip: {
    toStacked: "切换到多行视图",
    toSingle: "切换到单行视图",
    stacked: "多行视图",
    single: "单行视图",
  },

  settings: {
    title: "设置",
    close: "关闭设置",
    sectionsLabel: "设置分类",

    tabAppearance: "外观",
    tabPlayback: "播放",
    tabClips: "片段检测",

    theme: "主题",
    language: "语言",

    waveformView: "波形显示",
    singleRow: "单行",
    stacked: "多行",
    singleRowHint: "在一行中显示完整波形，并在播放时自动跟随当前位置。",

    skipBy: "快进或后退",

    repeatsPerClip: "片段重复次数",
    repeatsHint: "设置点击片段后自动重复播放的次数。",

    showAdvanced: "显示高级控制",
    showAdvancedHint: "在波形下方显示片段合并和重复次数的快捷控制。",

    silenceThreshold: "静音灵敏度",
    silenceHint: "控制声音需要多安静才会被识别为停顿。数值越低，只会识别更安静的停顿。",

    analysisDetail: "分段精度",
    analysisHint: "数值越小，分段位置越精确，但处理时间可能稍长。",

    minClipLength: "最短片段长度",
    minClipLengthHint: "短于此长度的片段会自动与附近的片段合并。",

    resetAll: "恢复默认设置",
    changesLive: "修改立即生效并自动保存",
  },

  themes: {
    dark: "岩灰",
    light: "薄雾",
    midnight: "午夜",
    paper: "晴空",
    nova: "星辉",
    rose: "丁香",
  },

  app: {
    skippedNonMp3: "已跳过 {count} 个文件，目前仅支持 MP3 文件。",
    skippedNonMp3Plural: "已跳过 {count} 个文件，目前仅支持 MP3 文件。",
  },

  errorBoundary: {
    crashed: "出现了一些问题",
  },
};

/** Recursively turns `as const` leaf literals into plain `string`s. */
export type DeepStringify<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringify<T[K]>;
};

/** Message shape any locale must satisfy (English keys, string leaves). */
export type Messages = DeepStringify<typeof en>;

/** Recursively builds a dot-path key union, e.g. "settings.tabPlayback". */
export type TranslationKey = {
  [K in keyof Messages]: Messages[K] extends string
  ? K extends string
  ? K
  : never
  : K extends string
  ? `${K}.${DeepKeys<Messages[K]>}`
  : never;
}[keyof Messages];

type DeepKeys<T> = T extends string
  ? never
  : {
    [K in keyof T]-?: K extends string
    ? T[K] extends string
    ? K
    : `${K}.${DeepKeys<T[K]>}`
    : never;
  }[keyof T];

export type TranslationParams = Record<string, string | number>;

const dictionaries: Record<string, Messages> = { en, zh };

export type LocaleId = keyof typeof dictionaries;

export const LOCALE_IDS = Object.keys(dictionaries) as LocaleId[];

export function isLocale(value: unknown): value is LocaleId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(dictionaries, value)
  );
}

export function dictionaryFor(locale: string): Messages {
  return dictionaries[locale] ?? en;
}

/**
 * Resolves a dot-path key against a message object and interpolates
 * `{name}` params. Falls back to the key itself when missing.
 */
export function translate(
  messages: Messages,
  key: TranslationKey,
  params?: TranslationParams,
): string {
  let value: unknown = messages;
  for (const part of key.split(".")) {
    if (typeof value !== "object" || value === null) break;
    value = (value as Record<string, unknown>)[part];
  }
  if (typeof value !== "string") {
    if (import.meta.env.DEV) console.warn(`[i18n] missing translation for "${key}"`);
    return key;
  }
  if (!params) return value;
  return value.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}