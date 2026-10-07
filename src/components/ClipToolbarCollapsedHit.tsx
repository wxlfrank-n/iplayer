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
import {useDrag} from '@use-gesture/react';

import {TOOLBAR_SWIPE_THRESHOLD_PX} from './ClipToolbar';

import {useAppDispatch} from '../store/hooks';
import {updateConfig} from '../store/configSlice';

import './ClipToolbar.css';

export function ClipToolbarCollapsedHit() {
  const dispatch = useAppDispatch();

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

  /*
   * Swipe down expands the toolbar.
   */
  const bindHit = useDrag(
    ({last, event, initial}) => {
      if (!last) return;

      /*
       * Use the pointer position of the releasing event rather than the
       * accumulated `movement`: a fast gesture may deliver pointerup at a new
       * position without an intermediate pointermove.
       */
      const pointer = event as PointerEvent;

      const dy = pointer.clientY - initial[1];
      const absY = Math.abs(dy);
      const absX = Math.abs(pointer.clientX - initial[0]);

      if (absY >= TOOLBAR_SWIPE_THRESHOLD_PX && absY > absX && dy > 0) {
        expand();
      }
    },
    {
      pointer: {capture: false, buttons: -1, keys: false},
    },
  );

  return (
    <div
      className="clip-toolbar__collapsed-hit"
      onDoubleClick={handleDoubleClick}
      {...bindHit()}
    />
  );
}
