/**
 * Settings panel overlay.
 *
 * Configurable options:
 * - Waveform view: "stacked" (multiple rows) or "horizontal" (single scrollable row)
 * - Skip interval: 5, 10, 15, 20, or 30 seconds for forward/backward buttons
 *
 * Changes persist to localStorage via useConfig hook.
 */

import { useConfig } from "../hooks/useConfig";
import CloseIcon from "../assets/icons/close.svg?react";

interface SettingsProps {
  onClose: () => void;
}

export function Settings({ onClose }: SettingsProps) {
  const { config, updateConfig } = useConfig();
  const { skipSeconds, waveformView } = config;
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
          <label className="settings-label">Waveform view</label>
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
              One row
            </button>
          </div>
          <label className="settings-label">Skip interval (seconds)</label>
          <div className="settings-row">
            {[5, 10, 15, 20, 30].map((val) => (
              <button
                key={val}
                className={`settings-chip ${skipSeconds === val ? "settings-chip--active" : ""}`}
                onClick={() => updateConfig({ skipSeconds: val })}
              >
                {val}s
              </button>
            ))}
          </div>
          <input
            type="number"
            min={1}
            max={60}
            value={skipSeconds}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (v >= 1 && v <= 60) updateConfig({ skipSeconds: v });
            }}
            className="settings-input"
          />
        </div>
      </div>
    </div>
  );
}
