/**
 * Top action buttons for the player: playlist toggle and settings. Playlist
 * state and the settings overlay remain owned by the app shell.
 */

import { memo } from "react";
import PlaylistIcon from "../assets/icons/playlist.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";

interface PlayerActionsProps {
  playlistOpen: boolean;
  onTogglePlaylist: () => void;
  onOpenSettings: () => void;
}

export const PlayerActions = memo(function PlayerActions({
  playlistOpen,
  onTogglePlaylist,
  onOpenSettings,
}: PlayerActionsProps) {
  return (
    <div className="player-main__top-actions">
      <button
        className={`playlist-toggle control-btn ${playlistOpen ? "playlist-toggle--active" : ""}`}
        onClick={onTogglePlaylist}
        aria-pressed={playlistOpen}
        aria-label={playlistOpen ? "Hide playlist" : "Show playlist"}
        title={playlistOpen ? "Hide playlist" : "Show playlist"}
      >
        <PlaylistIcon width={20} height={20} />
      </button>
      <button
        className="settings-btn control-btn"
        onClick={onOpenSettings}
        aria-label="Settings"
        title="Settings"
      >
        <SettingsIcon width={20} height={20} />
      </button>
    </div>
  );
});