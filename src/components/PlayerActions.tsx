/**
 * Top action buttons for the player: playlist toggle and settings. Playlist
 * state and the settings overlay remain owned by the app shell.
 */

import { memo } from "react";
import PlaylistIcon from "../assets/icons/playlist.svg?react";
import SettingsIcon from "../assets/icons/settings.svg?react";
import { useT } from "../i18n";
import "./PlayerActions.css";

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
  const t = useT();
  return (
    <div className="player-main__top-actions">
      <button
        className={`playlist-toggle control-btn ${playlistOpen ? "playlist-toggle--active" : ""}`}
        onClick={onTogglePlaylist}
        aria-pressed={playlistOpen}
        aria-label={playlistOpen ? t("actions.hidePlaylist") : t("actions.showPlaylist")}
        title={playlistOpen ? t("actions.hidePlaylist") : t("actions.showPlaylist")}
      >
        <PlaylistIcon width={20} height={20} />
      </button>
      <button
        className="settings-btn control-btn"
        onClick={onOpenSettings}
        aria-label={t("actions.settings")}
        title={t("actions.settings")}
      >
        <SettingsIcon width={20} height={20} />
      </button>
    </div>
  );
});