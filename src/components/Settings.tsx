/**
 * Settings panel overlay.
 *
 * Settings are grouped into domain sections (Playback / Clip detection). Every
 * numeric option uses the same slider field: value readout on the right, slider
 * in the middle with min/max captions underneath, and quick presets as subtle
 * ghost chips below. Ranges live in `CONFIG_RANGES`; values are clamped to
 * stay valid.
 */

import type { ReactNode } from "react";
import { useConfig } from "../hooks/useConfig";
import { CONFIG_RANGES, DEFAULT_CONFIG } from "../store/configSlice";
import CloseIcon from "../assets/icons/close.svg?react";

interface SettingsProps {
  onClose: () => void;
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));

function SettingSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="settings-section">
      <h3 className="settings-section-title">{title}</h3>
      {children}
    </section>
  );
}

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

export function Settings({ onClose }: SettingsProps) {
  const { config, updateConfig } = useConfig();
  const {
    skipSeconds,
    waveformView,
    blockMs,
    silenceRatio,
    minSilenceLength,
    minClipLength,
  } = config;
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} title="Close">
            <CloseIcon width={18} height={18} />
          </button>
        </div>
        <div className="settings-body">
          <SettingSection title="Playback">
            <div className="settings-field">
              <div className="settings-field-head">
                <label className="settings-label">Waveform view</label>
              </div>
              <div className="settings-row">
                <button
                  className={`settings-chip ${waveformView === "stacked" ? "settings-chip--active" : ""}`}
                  onClick={() => updateConfig({ waveformView: "stacked" })}
                >
                  Stacked
                </button>
                <button
                  className={`settings-chip ${waveformView === "horizontal" ? "settings-chip--active" : ""}`}
                  onClick={() => updateConfig({ waveformView: "horizontal" })}
                >
                  Single row
                </button>
              </div>
            </div>
            <SliderSetting
              label="Skip forward / back by"
              presets={[5, 10, 15, 20, 30]}
              value={skipSeconds}
              min={CONFIG_RANGES.skipSeconds.min}
              max={CONFIG_RANGES.skipSeconds.max}
              step={1}
              unit="s"
              onChange={(v) => updateConfig({ skipSeconds: v })}
            />
          </SettingSection>
          <SettingSection title="Clip detection">
            <SliderSetting
              label="Silence threshold"
              hint="How quiet a block must be to count as silence. Lower values = only very quiet parts are detected."
              presets={[0.005, 0.01, 0.02, 0.05]}
              value={silenceRatio}
              min={CONFIG_RANGES.silenceRatio.min}
              max={CONFIG_RANGES.silenceRatio.max}
              step={0.005}
              onChange={(v) => updateConfig({ silenceRatio: v })}
            />
            <SliderSetting
              label="Analysis detail"
              hint="Audio chunk granularity in milliseconds. Smaller = more precise splits, larger = faster processing."
              presets={[4, 8, 12, 24]}
              value={blockMs}
              min={CONFIG_RANGES.blockMs.min}
              max={CONFIG_RANGES.blockMs.max}
              step={1}
              unit="ms"
              onChange={(v) => updateConfig({ blockMs: v })}
            />
            <SliderSetting
              label="Minimum gap between clips"
              hint="Shortest silence duration that splits two clips apart. Lower = more granular splits."
              presets={[0.1, 0.2]}
              value={minSilenceLength}
              min={CONFIG_RANGES.minSilenceLength.min}
              max={CONFIG_RANGES.minSilenceLength.max}
              step={0.01}
              unit="s"
              onChange={(v) => updateConfig({ minSilenceLength: v })}
            />
            <SliderSetting
              label="Minimum clip length"
              hint="Shortest clip kept after splitting. Shorter clips are folded into a neighbor when the gap is small."
              presets={[0.1, 0.2, 0.3, 0.5]}
              value={minClipLength}
              min={CONFIG_RANGES.minClipLength.min}
              max={CONFIG_RANGES.minClipLength.max}
              step={0.05}
              unit="s"
              onChange={(v) => updateConfig({ minClipLength: v })}
            />
          </SettingSection>
        </div>
        <div className="settings-footer">
          <button
            className="settings-reset"
            onClick={() => updateConfig(DEFAULT_CONFIG)}
          >
            Reset all
          </button>
          <span className="settings-footer-note">
            Changes apply live &middot; saved automatically
          </span>
        </div>
      </div>
    </div>
  );
}