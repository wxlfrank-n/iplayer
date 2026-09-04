interface VolumeControlProps {
  volume: number;
  isMuted: boolean;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
}

export function VolumeControl({
  volume,
  isMuted,
  onVolumeChange,
  onToggleMute,
}: VolumeControlProps) {
  const displayVolume = isMuted ? 0 : volume;

  const getVolumeIcon = () => {
    if (isMuted || displayVolume === 0) return "\u{1F507}";
    if (displayVolume < 0.3) return "\u{1F509}";
    if (displayVolume < 0.7) return "\u{1F50A}";
    return "\u{1F50A}";
  };

  return (
    <div className="volume-control">
      <button className="icon-btn" onClick={onToggleMute} title={isMuted ? "Unmute" : "Mute"}>
        {getVolumeIcon()}
      </button>
      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={displayVolume}
        onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
        className="volume-slider"
      />
    </div>
  );
}
