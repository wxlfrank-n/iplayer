interface SettingsProps {
  skipSeconds: number;
  onSkipSecondsChange: (value: number) => void;
  mergeSeconds: number;
  onMergeSecondsChange: (value: number) => void;
  onClose: () => void;
}

export function Settings({
  skipSeconds,
  onSkipSecondsChange,
  mergeSeconds,
  onMergeSecondsChange,
  onClose,
}: SettingsProps) {
  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>Settings</h2>
          <button className="settings-close" onClick={onClose} title="Close">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
        <div className="settings-body">
          <label className="settings-label">Skip interval (seconds)</label>
          <div className="settings-row">
            {[5, 10, 15, 20, 30].map((val) => (
              <button
                key={val}
                className={`settings-chip ${skipSeconds === val ? "settings-chip--active" : ""}`}
                onClick={() => onSkipSecondsChange(val)}
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
              if (v >= 1 && v <= 60) onSkipSecondsChange(v);
            }}
            className="settings-input"
          />

          <label className="settings-label">Merge sectors closer than (seconds)</label>
          <input
            type="number"
            min={0}
            max={10}
            step={0.1}
            value={mergeSeconds}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (v >= 0 && v <= 10) onMergeSecondsChange(v);
            }}
            className="settings-input"
          />
        </div>
      </div>
    </div>
  );
}
