/**
 * Renders one detected audio clip as an interactive
 * overlay on the waveform.
 *
 * Gesture ownership:
 *
 * tap
 *   -> activate / play this clip
 *
 * vertical swipe
 *   -> split / merge
 *
 * diagonal swipe (35-55 deg)
 *   -> down-right: merge with the clip to the right
 *   -> up-right: split the rightmost part of the merged clip
 *   -> up-left: split the leftmost part of the merged clip
 *
 * horizontal drag
 *   -> NOT handled here
 *   -> observed by the waveform container
 *   -> RowWaveform scrolls
 *   -> StackedWaveform changes page
 *
 * The drag gesture never captures the pointer on pointer-down
 * (`pointer: {capture: false}`): at that moment we do not yet know
 * whether the user intends a vertical clip gesture or horizontal
 * navigation, so the waveform parent must keep observing the pointer too.
 */

import {memo, useEffect, useRef, type ReactNode} from 'react';
import {useDrag} from '@use-gesture/react';

import {clipGestureLedger} from './clipPinch';

import type {Clip as InitClipData} from '../utils/clips';
import type {SwipeDirection, WaveWindow} from '../types';

import {formatTimePrecise} from '../utils/time';
import './Clip.css';

export interface ClipProps {
  clip: InitClipData;

  window: WaveWindow;

  /** Global clip index. */
  id: number;

  active: boolean;

  label?: ReactNode;

  onPlayRange: (start: number, end: number, repetitions: number) => void;

  repetitions: number;

  playing: boolean;

  onStopPlayback?: () => void;

  onActivate: (idx: number) => void;

  onSwipe?: (idx: number, direction: SwipeDirection) => void;
}

const SWIPE_THRESHOLD_PX = 24;
const TAP_THRESHOLD_PX = 8;

/*
 * Diagonal band boundaries, expressed as the slope of |dy|/|dx| (tan of the
 * angle from the horizontal):
 *
 *   |dy|/|dx| <                 tan(15 deg) -> horizontal scroll (parent owns)
 *   tan(15 deg) <= |dy|/|dx| <= tan(75 deg) -> diagonal clip gesture
 *   |dy|/|dx| >                 tan(75 deg) -> vertical swipe
 *
 * Each gesture direction is a 60-degree slice:
 *
 *   0-15 / 345-360 -> right scroll, 165-195 -> left scroll
 *   15-75          -> up-right, 105-165 -> up-left
 *   75-105         -> up / split, 255-285 -> down / merge
 *   105-165        -> up-left, 195-255 -> down-left
 *   285-345        -> down-right
 */
export const DIAGONAL_MIN_TAN = Math.tan((15 * Math.PI) / 180);
export const DIAGONAL_MAX_TAN = Math.tan((75 * Math.PI) / 180);

export const Clip = memo(
  ({
    clip,
    window,
    id,
    active,
    label,
    onPlayRange,
    repetitions,
    playing,
    onStopPlayback,
    onActivate,
    onSwipe,
  }: ClipProps) => {
    const {windowStartSec, windowLen, innerH, vbH} = window;

    const suppressClickRef = useRef(false);

    /*
     * True when another clip pointer was already down when this one landed.
     * Such a pointer can never become a tap, whatever it does afterwards.
     */
    const multiPointerRef = useRef(false);

    /*
     * Pointers this component registered in the shared ledger. If the clip
     * unmounts mid-gesture (e.g. a pinch merge replaces the clips while the
     * second finger is still down), `last` never runs for that pointer, so the
     * entry must be cleaned here or every later tap would be suppressed.
     */
    const pointerIdsRef = useRef<Set<number>>(new Set());
    useEffect(
      () => () => {
        for (const pointerId of pointerIdsRef.current) {
          clipGestureLedger.active.delete(pointerId);
        }
        if (clipGestureLedger.active.size === 0) {
          clipGestureLedger.multi = false;
        }
      },
      [],
    );

    /*
     * Clip band occupies the middle half of the
     * waveform vertically.
     */
    const topPct = ((vbH / 2 - innerH / 4) / vbH) * 100;

    const heightPct = (innerH / 2 / vbH) * 100;

    const leftPct = ((clip.vStart - windowStartSec) / windowLen) * 100;

    const widthPct = Math.max(
      0.2,
      ((clip.vEnd - clip.vStart) / windowLen) * 100,
    );

    const activateClip = () => {
      if (playing && active) {
        onStopPlayback?.();

        return;
      }

      onActivate(id);

      onPlayRange(clip.vStart, clip.vEnd, repetitions);
    };

    /*
     * ---------------------------------------------------------
     * TAP / SWIPE
     * ---------------------------------------------------------
     *
     * `pointer: {capture: false}` is deliberate: Clip must NOT capture the
     * pointer on pointer-down. Both Clip and its waveform parent need to
     * observe the movement until the gesture direction becomes clear.
     *
     * `buttons: -1` keeps the historical behavior of reacting to any button.
     */
    const bindClip = useDrag(
      ({first, last, event, initial, target, currentTarget}) => {
        if (first) {
          suppressClickRef.current = false;

          const pointerId = (event as PointerEvent).pointerId;

          multiPointerRef.current = clipGestureLedger.active.size > 0;
          if (multiPointerRef.current) {
            /*
             * A second finger landing on another clip is part of a multi-finger
             * gesture (e.g. the pinch merge): it must never be read as a tap.
             */
            suppressClickRef.current = true;
          }
          clipGestureLedger.active.add(pointerId);
          pointerIdsRef.current.add(pointerId);
          if (clipGestureLedger.active.size > 1) {
            clipGestureLedger.multi = true;
          }

          return;
        }

        if (!last) {
          return;
        }

        const pointer = event as PointerEvent;

        /*
         * Whatever ends the gesture, this pointer is no longer down.
         */
        pointerIdsRef.current.delete(pointer.pointerId);
        clipGestureLedger.active.delete(pointer.pointerId);
        if (clipGestureLedger.active.size === 0) {
          clipGestureLedger.multi = false;
        }

        if (event.type === 'pointercancel') {
          suppressClickRef.current = true;

          return;
        }

        /*
         * A tap is only a tap when this pointer never overlapped another clip
         * pointer. `multi` covers sessions that started (and ended) here; the
         * ref covers the case where this pointer joined late.
         */
        if (multiPointerRef.current || clipGestureLedger.multi) {
          suppressClickRef.current = true;

          return;
        }

        /*
         * Use the pointer position of the releasing event rather than the
         * accumulated `movement`: a fast gesture may deliver pointerup at a
         * new position without an intermediate pointermove, and use-gesture
         * accumulates movement only on pointermove.
         */
        const dx = pointer.clientX - initial[0];

        const dy = pointer.clientY - initial[1];

        const absX = Math.abs(dx);

        const absY = Math.abs(dy);

        /*
         * Diagonal swipes (15-75 degrees from the horizontal):
         *
         *   down-right -> merge with the clip to the right
         *   down-left  -> merge with the clip to the left
         *   up-right   -> split the rightmost part of the merged clip
         *   up-left    -> split the leftmost part of the merged clip
         *
         * Clip owns these gestures, like the vertical swipe. Checked before
         * the vertical band so the 15-75 deg slice never falls through to one
         * of the plain up/down swipes.
         */
        const ratio = absX > 0 ? absY / absX : Infinity;
        if (
          dx > 0 &&
          Math.hypot(dx, dy) >= SWIPE_THRESHOLD_PX &&
          ratio >= DIAGONAL_MIN_TAN &&
          ratio <= DIAGONAL_MAX_TAN
        ) {
          suppressClickRef.current = true;

          onSwipe?.(id, dy > 0 ? 'down-right' : 'up-right');

          return;
        }

        if (
          dx < 0 &&
          dy > 0 &&
          Math.hypot(dx, dy) >= SWIPE_THRESHOLD_PX &&
          ratio >= DIAGONAL_MIN_TAN &&
          ratio <= DIAGONAL_MAX_TAN
        ) {
          suppressClickRef.current = true;

          onSwipe?.(id, 'down-left');

          return;
        }

        if (
          dx < 0 &&
          dy < 0 &&
          Math.hypot(dx, dy) >= SWIPE_THRESHOLD_PX &&
          ratio >= DIAGONAL_MIN_TAN &&
          ratio <= DIAGONAL_MAX_TAN
        ) {
          suppressClickRef.current = true;

          onSwipe?.(id, 'up-left');

          return;
        }

        /*
         * Vertical swipe:
         *
         * Clip owns this gesture.
         */
        if (absY >= SWIPE_THRESHOLD_PX && ratio > DIAGONAL_MAX_TAN) {
          suppressClickRef.current = true;

          onSwipe?.(id, dy < 0 ? 'up' : 'down');

          return;
        }

        /*
         * Horizontal movement:
         *
         * The parent waveform owns horizontal navigation.
         *
         * StackedWaveform:
         *   swipe left  -> next page
         *   swipe right -> previous page
         *
         * RowWaveform:
         *   horizontal pan
         */
        if (absX >= TAP_THRESHOLD_PX) {
          suppressClickRef.current = true;

          return;
        }

        /*
         * Small vertical movement that isn't a swipe
         * shouldn't accidentally become a tap.
         */
        if (absY >= TAP_THRESHOLD_PX) {
          suppressClickRef.current = true;

          return;
        }

        /*
         * Genuine tap.
         */
        suppressClickRef.current = true;

        if (target !== currentTarget) {
          return;
        }
        activateClip();
      },
      {
        pointer: {capture: false, buttons: -1, keys: false},
      },
    );

    /*
     * Browsers may synthesize a click after pointerup.
     *
     * The tap has already been handled above, so suppress
     * that synthetic click.
     */
    const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation();

      if (suppressClickRef.current) {
        suppressClickRef.current = false;

        return;
      }

      /*
       * Keyboard / accessibility generated click.
       */
      activateClip();
    };

    return (
      <div
        className={`waveform-clip ${active ? 'waveform-clip--active' : ''}`}
        data-clip-idx={id}
        style={{
          left: `${leftPct}%`,
          top: `${topPct}%`,
          width: `${widthPct}%`,
          height: `${heightPct}%`,
        }}
        title={`${formatTimePrecise(clip.vStart)} - ${formatTimePrecise(
          clip.vEnd,
        )}`}
        onClick={handleClick}
        {...bindClip()}
      >
        {label}
      </div>
    );
  },
);
