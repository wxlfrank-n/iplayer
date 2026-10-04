/**
 * Re-expand target for the collapsed clip toolbar.
 *
 * When the clip toolbar is collapsed its box leaves the layout, so this renders
 * an absolutely positioned strip at the bottom edge of progress-container
 * (see .clip-toolbar__collapsed-hit in ClipToolbar.css). Double-click or a
 * swipe down brings the toolbar back, mirroring how the toolbar hides itself on
 * a double-click or swipe up.
 *
 * The strip is invisible and reserves no layout space, so the collapsed
 * waveform keeps its full height.
 */
import {useRef} from 'react';
import type {PointerEvent} from 'react';

import {TOOLBAR_SWIPE_THRESHOLD_PX} from './ClipToolbar';

import {useAppDispatch} from '../store/hooks';
import {updateConfig} from '../store/configSlice';

import './ClipToolbar.css';

export function ClipToolbarCollapsedHit() {
  const dispatch = useAppDispatch();

  /*
   * Pointer start for the swipe-down gesture that re-expands the toolbar.
   */
  const pointerStartRef = useRef<{x: number; y: number} | null>(null);

  const expand = () => {
    dispatch(
      updateConfig({
        showAdvancedControls: true,
      }),
    );
  };

  const handleDoubleClick = () => {
    expand();
  };

  const handlePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
    };
  };

  const handlePointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;

    pointerStartRef.current = null;

    if (!start) {
      return;
    }

    const dy = e.clientY - start.y;
    const absY = Math.abs(dy);
    const absX = Math.abs(e.clientX - start.x);

    /*
     * Swipe down expands the toolbar.
     */
    if (absY >= TOOLBAR_SWIPE_THRESHOLD_PX && absY > absX && dy > 0) {
      expand();
    }
  };

  const handlePointerCancel = () => {
    pointerStartRef.current = null;
  };

  return (
    <div
      className="clip-toolbar__collapsed-hit"
      onDoubleClick={handleDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
    />
  );
}
