/**
 * Displays currently playing track information.
 *
 * Shows:
 * - Track title and artist
 * - Audio metadata (channels, sample rate, bitrate)
 * - Music note icon (static when no track, animated when playing)
 *
 * Falls back to "No track selected" message when the playlist is empty.
 */

import { memo } from "react";
import { useAudioMeta } from "../hooks/useAudioMeta";
import { useAppSelector } from "../store/hooks";
import { selectCurrentTrack } from "../store/selectors";
import MusicNoteIcon from "../assets/icons/music-note.svg?react";

export const NowPlaying = memo(function NowPlaying() {
  const track = useAppSelector(selectCurrentTrack);
  // Fetch and display audio metadata (channels, sample rate, bitrate)
  const meta = useAudioMeta(track?.url ?? null);

  if (!track) {
    return (
      <div className="now-playing now-playing--empty">
        <div className="now-playing__art">
          <MusicNoteIcon width={32} height={32} opacity={0.4} />
        </div>
        <div className="now-playing__info">
          <span className="now-playing__title">No track selected</span>
          <span className="now-playing__artist">Add music to get started</span>
        </div>
      </div>
    );
  }

  return (
    <div className="now-playing">
      <div className="now-playing__art now-playing__art--active">
        <MusicNoteIcon width={28} height={28} />
      </div>
      <div className="now-playing__info">
        <span className="now-playing__title">{track.title}</span>
        <span className="now-playing__artist">{track.artist}</span>
        {meta && (
          <span className="now-playing__meta">
            {meta.channels === 1 ? "Mono" : "Stereo"}
            {" · "}
            {(meta.sampleRate / 1000).toFixed(1)} kHz{" · "}
            {meta.bitrate} kbps
          </span>
        )}
      </div>
    </div>
  );
});
