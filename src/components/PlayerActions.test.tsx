// @vitest-environment jsdom

import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {PlayerActions} from './PlayerActions';

afterEach(cleanup);

function setup() {
  const onTogglePlaylist = vi.fn();
  const onOpenSettings = vi.fn();
  const view = render(
    <PlayerActions
      playlistOpen={false}
      onTogglePlaylist={onTogglePlaylist}
      onOpenSettings={onOpenSettings}
    />,
  );
  return {view, onTogglePlaylist, onOpenSettings};
}

describe('PlayerActions', () => {
  it('opens a menu with both actions', () => {
    setup();
    const button = screen.getByRole('button');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(button.classList.contains('player-actions__button--hidden')).toBe(
      false,
    );
    fireEvent.click(button);
    // The trigger button is hidden while the menu is open.
    expect(button.classList.contains('player-actions__button--hidden')).toBe(
      true,
    );
    expect(screen.getAllByRole('menuitem').map(m => m.textContent)).toEqual([
      'Playlist',
      'Settings',
    ]);
  });

  it('toggles playlist when the Playlist item is selected', () => {
    const {onTogglePlaylist} = setup();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Playlist'}));
    expect(onTogglePlaylist).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe(
      'false',
    );
  });

  it('opens settings when the Settings item is selected', () => {
    const {onOpenSettings} = setup();
    fireEvent.click(screen.getByRole('button'));
    fireEvent.click(screen.getByRole('menuitem', {name: 'Settings'}));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    setup();
    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(screen.queryByRole('menu')).toBeTruthy();
    fireEvent.keyDown(button, {key: 'Escape'});
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('moves the highlight with the arrow keys and activates on Enter', () => {
    const {onOpenSettings, onTogglePlaylist} = setup();
    const button = screen.getByRole('button');
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    expect(screen.queryByRole('menu')).toBeTruthy();
    fireEvent.keyDown(button, {key: 'Enter'});
    expect(onTogglePlaylist).toHaveBeenCalledTimes(1);

    // Reopening resets the highlight to the first item.
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'Enter'});
    expect(onOpenSettings).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'Enter'});
    expect(onTogglePlaylist).toHaveBeenCalledTimes(2);

    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'ArrowDown'});
    fireEvent.keyDown(button, {key: 'Enter'});
    expect(onOpenSettings).toHaveBeenCalledTimes(2);
  });
});
