/**
 * Settings panel overlay.
 *
 * Settings are grouped into domain sections, switched with tabs (Appearance /
 * Playback / Clip detection). Every numeric option uses the same slider field:
 * value readout on the right, slider in the middle with min/max captions
 * underneath, and quick presets as subtle ghost chips below. Ranges live in
 * `CONFIG_RANGES`; values are clamped to stay valid.
 */

import { useCallback, useState, type KeyboardEvent } from "react";
import { useConfig } from "../hooks/useConfig";
import { CONFIG_RANGES, DEFAULT_CONFIG } from "../store/configSlice";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { THEMES, THEME_IDS, type ThemeId } from "../themes";
import { LanguageSelect } from "./LanguageSelect";
import { useT, type TranslationKey } from "../i18n";
import CloseIcon from "../assets/icons/close.svg?react";
import "./Settings.css";

interface SettingsProps {
  onClose: () => void;
}

const SETTINGS_TABS = [{ id: "theme" }, { id: "playback" }, { id: "clips" }] as const;

type SettingsTabId = (typeof SETTINGS_TABS)[number]["id"];

const TAB_LABEL_KEYS: Record<SettingsTabId, TranslationKey> = {
  theme: "settings.tabAppearance",
  playback: "settings.tabPlayback",
  clips: "settings.tabClips",
};

const THEME_LABEL_KEYS: Record<ThemeId, TranslationKey> = {
  dark: "themes.dark",
  light: "themes.light",
  midnight: "themes.midnight",
  paper: "themes.paper",
  nova: "themes.nova",
  rose: "themes.rose",
};

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

interface SliderSettingProps {
  label: string;
  hint?: string;
  presets: number[];
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
}

function SliderSetting({
  label,
  hint,
  presets,
  value,
  min,
  max,
  step,
  unit = "",
  onChange,
}: SliderSettingProps) {
  const display = clamp(value, min, max);
  return (
    <div className="settings-field">
      <div className="settings-field-head">
        <label className="settings-label">{label}</label>
        <output className="settings-value">
          {display}
          {unit}
        </output>
      </div>
      {hint && <p className="settings-hint">{hint}</p>}
      <input
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        step={step}
        value={display}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
      <div className="settings-range-captions">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
      <div className="settings-row settings-presets">
        {presets.map((val) => (
          <button
            key={val}
            className={`settings-chip settings-chip--preset ${display === val ? "settings-chip--active" : ""}`}
            onClick={() => onChange(val)}
          >
            {val}
            {unit}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThemeCardPreview({ theme }: { theme: ThemeId }) {
  const t = THEMES[theme];
  return (
    <span
      className="theme-card__swatch"
      style={{ background: t.bgPrimary }}
      aria-hidden="true"
    >
      <span
        className="theme-card__bar"
        style={{
          background: t.bgSecondary,
          border: `1px solid ${t.border}`,
        }}
      >
        <span
          className="theme-card__bar-line"
          style={{ background: t.textSecondary }}
        />
      </span>
      <span
        className="theme-card__dot"
        style={{ background: t.accent }}
      />
    </span>
  );
}

function AppearanceTab() {
  const { config, updateConfig } = useConfig();
  const t = useT();
  return (
    <>
      <div className="settings-field">
        <div className="settings-field-head">
          <label className="settings-label">{t("settings.language")}</label>
        </div>
        <LanguageSelect
          value={config.language}
          onChange={(language) => updateConfig({ language })}
          label={t("settings.language")}
        />
      </div>
      <div className="settings-field">
        <div className="settings-field-head">
          <label id="theme-label" className="settings-label">
            {t("settings.theme")}
          </label>
        </div>
        <div className="theme-grid" role="group" aria-labelledby="theme-label">
          {THEME_IDS.map((id) => (
            <button
              key={id}
              className={`theme-card ${config.theme === id ? "theme-card--active" : ""}`}
              onClick={() => updateConfig({ theme: id })}
              aria-pressed={config.theme === id}
            >
              <ThemeCardPreview theme={id} />
              <span className="theme-card__label">{t(THEME_LABEL_KEYS[id])}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

function PlaybackTab() {
  const { config, updateConfig } = useConfig();
  const t = useT();
  const {
    waveformView,
    skipSeconds,
    repetitions,
    showAdvancedControls,
  } = config;
  return (
    <>
      <div className="settings-field">
        <div className="settings-field-head">
          <label className="settings-label">{t("settings.waveformView")}</label>
          <output className="settings-value">
            {waveformView === "horizontal" ? t("settings.singleRow") : t("settings.stacked")}
          </output>
        </div>
        <label className="settings-switch">
          <input
            type="checkbox"
            checked={waveformView === "horizontal"}
            onChange={(e) =>
              updateConfig({
                waveformView: e.target.checked ? "horizontal" : "stacked",
              })
            }
          />
          <span className="settings-switch__track" aria-hidden="true">
            <span className="settings-switch__knob" />
          </span>
          <span className="settings-switch__label">
            {t("settings.singleRow")}
            <small>{t("settings.singleRowHint")}</small>
          </span>
        </label>
      </div>
      <SliderSetting
        label={t("settings.skipBy")}
        presets={[5, 10, 15, 20, 30]}
        value={skipSeconds}
        min={CONFIG_RANGES.skipSeconds.min}
        max={CONFIG_RANGES.skipSeconds.max}
        step={1}
        unit="s"
        onChange={(v) => updateConfig({ skipSeconds: v })}
      />
      <SliderSetting
        label={t("settings.repeatsPerClip")}
        hint={t("settings.repeatsHint")}
        presets={[1, 2, 3, 5, 10]}
        value={repetitions}
        min={CONFIG_RANGES.repetitions.min}
        max={CONFIG_RANGES.repetitions.max}
        step={1}
        onChange={(v) => updateConfig({ repetitions: v })}
      />
      <div className="settings-field">
        <label className="settings-checkbox">
          <input
            type="checkbox"
            checked={showAdvancedControls}
            onChange={(e) =>
              updateConfig({ showAdvancedControls: e.target.checked })
            }
          />
          <span>
            {t("settings.showAdvanced")}
            <small>{t("settings.showAdvancedHint")}</small>
          </span>
        </label>
      </div>
    </>
  );
}

function ClipDetectionTab() {
  const { config, updateConfig } = useConfig();
  const t = useT();
  const { blockMs, silenceRatio, minClipLength } = config;
  return (
    <>
      <SliderSetting
        label={t("settings.silenceThreshold")}
        hint={t("settings.silenceHint")}
        presets={[0.005, 0.01, 0.02, 0.05]}
        value={silenceRatio}
        min={CONFIG_RANGES.silenceRatio.min}
        max={CONFIG_RANGES.silenceRatio.max}
        step={0.005}
        onChange={(v) => updateConfig({ silenceRatio: v })}
      />
      <SliderSetting
        label={t("settings.analysisDetail")}
        hint={t("settings.analysisHint")}
        presets={[4, 8, 12, 24]}
        value={blockMs}
        min={CONFIG_RANGES.blockMs.min}
        max={CONFIG_RANGES.blockMs.max}
        step={1}
        unit="ms"
        onChange={(v) => updateConfig({ blockMs: v })}
      />
      <SliderSetting
        label={t("settings.minClipLength")}
        hint={t("settings.minClipLengthHint")}
        presets={[0.1, 0.2, 0.3, 0.5]}
        value={minClipLength}
        min={CONFIG_RANGES.minClipLength.min}
        max={CONFIG_RANGES.minClipLength.max}
        step={0.05}
        unit="s"
        onChange={(v) => updateConfig({ minClipLength: v })}
      />
    </>
  );
}

export function Settings({ onClose }: SettingsProps) {
  const { updateConfig } = useConfig();
  const t = useT();
  const close = useCallback(() => onClose(), [onClose]);
  const trapRef = useFocusTrap<HTMLDivElement>(true, close);
  const [activeTab, setActiveTab] = useState<SettingsTabId>("theme");

  const handleTabKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const idx = SETTINGS_TABS.findIndex((t) => t.id === activeTab);
    let next = -1;
    if (e.key === "ArrowRight") next = (idx + 1) % SETTINGS_TABS.length;
    else if (e.key === "ArrowLeft")
      next = (idx - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = SETTINGS_TABS.length - 1;
    else return;
    e.preventDefault();
    const tabId = SETTINGS_TABS[next].id;
    setActiveTab(tabId);
    document.getElementById(`settings-tab-${tabId}`)?.focus();
  };

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div
        className="settings-panel"
        ref={trapRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="settings-header">
          <h2>{t("settings.title")}</h2>
          <button
            className="settings-close"
            onClick={close}
            aria-label={t("settings.close")}
            title={t("common.close")}
          >
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div
          className="settings-tabs"
          role="tablist"
          aria-label={t("settings.sectionsLabel")}
          onKeyDown={handleTabKeyDown}
        >
          {SETTINGS_TABS.map(({ id }) => (
            <button
              key={id}
              id={`settings-tab-${id}`}
              role="tab"
              className={`settings-tab ${activeTab === id ? "settings-tab--active" : ""}`}
              aria-selected={activeTab === id}
              aria-controls={`settings-panel-${id}`}
              tabIndex={activeTab === id ? 0 : -1}
              onClick={() => setActiveTab(id)}
            >
              {t(TAB_LABEL_KEYS[id])}
            </button>
          ))}
        </div>
        <div
          id={`settings-panel-${activeTab}`}
          role="tabpanel"
          aria-labelledby={`settings-tab-${activeTab}`}
          className="settings-body"
        >
          {activeTab === "theme" && <AppearanceTab />}
          {activeTab === "playback" && <PlaybackTab />}
          {activeTab === "clips" && <ClipDetectionTab />}
        </div>
        <div className="settings-footer">
          <button
            className="settings-reset"
            onClick={() => updateConfig(DEFAULT_CONFIG)}
          >
            {t("settings.resetAll")}
          </button>
          <span className="settings-footer-note">
            {t("settings.changesLive")}
          </span>
        </div>
      </div>
    </div>
  );
}