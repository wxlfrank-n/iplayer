/**
 * The single top action for the player: a compact "more" button that opens a
 * small menu with the two app overlays (Playlist and Settings). Playlist state
 * and the settings overlay remain owned by the app shell.
 */

import {memo, useEffect, useId, useRef, useState} from 'react';
import type {KeyboardEvent} from 'react';
import PlaylistIcon from '../assets/icons/playlist.svg?react';
import SettingsIcon from '../assets/icons/settings.svg?react';
import {useT} from '../i18n';
import {onOutsideDismiss} from '../utils/listener';
import './PlayerActions.css';

interface PlayerActionsProps {
  playlistOpen: boolean;
  onTogglePlaylist: () => void;
  onOpenSettings: () => void;
}

const MENU_LABELS = ['playlist', 'settings'] as const;

export const PlayerActions = memo(
  ({onTogglePlaylist, onOpenSettings}: PlayerActionsProps) => {
    const t = useT();
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);
    const rootRef = useRef<HTMLDivElement>(null);
    const menuId = useId();
    const itemCount = MENU_LABELS.length;

    const openMenu = () => {
      setActiveIndex(0);
      setOpen(true);
    };

    useEffect(() => {
      if (!open) return;
      return onOutsideDismiss(rootRef.current, () => setOpen(false));
    }, [open]);

    const activate = (index: number) => {
      setOpen(false);
      if (index === 0) onTogglePlaylist();
      else onOpenSettings();
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
      if (!open) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
          e.preventDefault();
          openMenu();
        }
        return;
      }
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex(i => (i + 1) % itemCount);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex(i => (i - 1 + itemCount) % itemCount);
          break;
        case 'Home':
          e.preventDefault();
          setActiveIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setActiveIndex(itemCount - 1);
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          activate(activeIndex);
          break;
      }
    };

    return (
      <div className="player-actions" ref={rootRef}>
        <button
          type="button"
          className={`player-actions__button control-btn ${
            open ? 'player-actions__button--hidden' : ''
          }`}
          aria-label={t('actions.more')}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-controls={menuId}
          aria-activedescendant={open ? `${menuId}-${activeIndex}` : undefined}
          onClick={() => (open ? setOpen(false) : openMenu())}
          onKeyDown={handleKeyDown}
          title={t('actions.more')}
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="12" cy="5" r="1.7" fill="currentColor" />
            <circle cx="12" cy="12" r="1.7" fill="currentColor" />
            <circle cx="12" cy="19" r="1.7" fill="currentColor" />
          </svg>
        </button>

        {open && (
          <ul
            id={menuId}
            role="menu"
            className="player-actions__menu"
            aria-label={t('actions.more')}
          >
            {MENU_LABELS.map((label, i) => (
              <li
                key={label}
                id={`${menuId}-${i}`}
                role="menuitem"
                className={`player-actions__item ${
                  activeIndex === i ? 'player-actions__item--active' : ''
                }`}
                onPointerEnter={() => setActiveIndex(i)}
                onClick={() => activate(i)}
              >
                {i === 0 ? (
                  <PlaylistIcon width={16} height={16} />
                ) : (
                  <SettingsIcon width={16} height={16} />
                )}
                <span>{t(`actions.${label}`)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  },
);
