/**
 * Playlist panel - shows all loaded tracks and allows adding/removing files.
 * Slides out as a sidebar overlay. Shows current track highlight.
 * Supports drag-and-drop and file input for adding new tracks.
 */

import {useRef, useCallback} from 'react';
import {TrackList} from './TrackList';
import {useAppSelector} from '../store/hooks';
import {selectTracks, selectCurrentTrackIndex} from '../store/selectors';
import {useFocusTrap} from '../hooks/useFocusTrap';
import {useT} from '../i18n';
import CloseIcon from '../assets/icons/close.svg?react';
import './Playlist.css';

interface PlaylistProps {
  onSelectTrack: (index: number) => void;
  onRemoveTrack: (index: number) => void;
  onAddFiles: (files: FileList) => void;
  onClose: () => void;
}

export function Playlist({
  onSelectTrack,
  onRemoveTrack,
  onAddFiles,
  onClose,
}: PlaylistProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tracks = useAppSelector(selectTracks);
  const currentTrackIndex = useAppSelector(selectCurrentTrackIndex);
  const t = useT();

  const handleClose = useCallback(() => onClose(), [onClose]);
  const trapRef = useFocusTrap<HTMLDivElement>(true, handleClose);

  return (
    <div className="playlist-overlay" onClick={onClose}>
      <div
        className="playlist-panel"
        ref={trapRef}
        tabIndex={-1}
        onClick={e => e.stopPropagation()}
      >
        <div className="playlist-header">
          <h2 id="playlist-title">
            {t('playlist.title', {count: tracks.length})}
          </h2>
          <div className="playlist-header__actions">
            <button
              className="add-btn"
              aria-label={t('playlist.addTracks')}
              onClick={() => fileInputRef.current?.click()}
            >
              +
            </button>
            <button
              className="playlist-close"
              onClick={handleClose}
              aria-label={t('playlist.close')}
              title={t('common.close')}
            >
              <CloseIcon width={18} height={18} />
            </button>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".mp3,audio/mpeg"
          multiple
          onChange={e => {
            if (e.target.files) onAddFiles(e.target.files);
            e.target.value = '';
          }}
          style={{display: 'none'}}
        />
        <TrackList
          tracks={tracks}
          currentTrackIndex={currentTrackIndex}
          onSelectTrack={onSelectTrack}
          onRemoveTrack={onRemoveTrack}
        />
      </div>
    </div>
  );
}
