/**
 * Top action buttons for the player: waveform view toggle, playlist toggle,
 * settings, and add-files. The waveform view reads/writes the config store
 * directly; playlist state and the file picker remain owned by the app shell.
 */

import { memo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { selectWaveformView } from "../store/selectors";
import { updateConfig } from "../store/configSlice";
import ViewStacked from "../assets/icons/view-stacked.svg?react";
import ViewSingle from "../assets/icons/view-single.svg?react";
import PlaylistIcon from "../assets/icons/playlist.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";

interface PlayerActionsProps {
  playlistOpen: boolean;
  onTogglePlaylist: () => void;
  onOpenSettings: () => void;
  onAddFiles: (files: FileList) => void;
}

export const PlayerActions = memo(function PlayerActions({
  playlistOpen,
  onTogglePlaylist,
  onOpenSettings,
  onAddFiles,
}: PlayerActionsProps) {
  const dispatch = useAppDispatch();
  const waveformView = useAppSelector(selectWaveformView);
  const isStacked = waveformView === "stacked";
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) onAddFiles(e.target.files);
    e.target.value = "";
  };

  const toggleView = () =>
    dispatch(
      updateConfig({
        waveformView: isStacked ? "horizontal" : "stacked",
      }),
    );

  return (
    <div className="player-main__top-actions">
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,audio/mpeg"
        multiple
        onChange={handleFileInput}
        style={{ display: "none" }}
      />
      <button
        className="view-toggle control-btn"
        onClick={toggleView}
        title={isStacked ? "Switch to single row" : "Switch to stacked rows"}
      >
        {isStacked ? (
          <ViewStacked width={20} height={20} />
        ) : (
          <ViewSingle width={20} height={20} />
        )}
      </button>
      <button
        className={`playlist-toggle control-btn ${playlistOpen ? "playlist-toggle--active" : ""}`}
        onClick={onTogglePlaylist}
        title={playlistOpen ? "Hide playlist" : "Show playlist"}
      >
        <PlaylistIcon width={20} height={20} />
      </button>
      <button
        className="settings-btn control-btn"
        onClick={onOpenSettings}
        title="Settings"
      >
        <SettingsIcon width={20} height={20} />
      </button>
      <button
        className="add-btn control-btn"
        onClick={() => fileInputRef.current?.click()}
      >
        +
      </button>
    </div>
  );
});