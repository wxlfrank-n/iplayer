/**
 * Two-finger "snip" across clips.
 *
 * When two pointers land on two different clips, the clips between them (both
 * ends included) merge if the fingers squeeze together -- the distance between
 * the pointers shrinks by at least PINCH_MERGE_THRESHOLD_PX -- before either
 * pointer is released.
 *
 * The merge is decided on release (the finger lift that ends the two-pointer
 * phase), never mid-gesture, so a glance at the distance at the end is enough.
 *
 * Detection lives on the waveform container (the element binding must contain
 * all clips): pointer events from both fingers bubble there, and the element
 * each pointer landed on is resolved through its `data-clip-idx` attribute.
 * Only pointers that land on a clip are tracked; a finger on the waveform
 * background does not form a candidate.
 *
 * While a pair is live, `clipPinchState.active` is set so the horizontal pan /
 * page drag stand down. Inward displacement is measured against the last known
 * position of the surviving pointer, tracked through window listeners.
 */

import {useCallback, useEffect, useRef} from 'react';
import type {PointerEvent as ReactPointerEvent} from 'react';

import {
  PINCH_MERGE_THRESHOLD_PX,
  clipPinchState,
} from '../components/clipPinch';

interface ActivePointer {
  pointerId: number;
  /** Global clip index the pointer landed on. */
  clipIndex: number;
  x: number;
  y: number;
}

interface MergeCandidate {
  a: number;
  b: number;
  low: number;
  high: number;
  startDist: number;
  fired: boolean;
}

const distance = (a: ActivePointer, b: ActivePointer) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const clipIndexAt = (target: EventTarget | null) => {
  if (!(target instanceof Element)) return -1;

  const el = target.closest('[data-clip-idx]') as HTMLElement | null;
  const raw = el?.dataset.clipIdx;
  if (raw === undefined) return -1;

  const index = Number(raw);
  return Number.isInteger(index) ? index : -1;
};

export function useClipPinchMerge(
  onMerge?: (lowIndex: number, highIndex: number) => void,
) {
  /*
   * Latest callback without re-binding the window listeners, which should live
   * as long as the container does.
   */
  const onMergeRef = useRef(onMerge);
  onMergeRef.current = onMerge;

  const pointersRef = useRef<Map<number, ActivePointer>>(new Map());
  const candidateRef = useRef<MergeCandidate | null>(null);

  const handlePointerEnd = useCallback((e: PointerEvent) => {
    const map = pointersRef.current;
    const candidate = candidateRef.current;
    const pointer = map.get(e.pointerId);

    if (
      candidate &&
      pointer &&
      (candidate.a === pointer.pointerId || candidate.b === pointer.pointerId)
    ) {
      const otherId =
        candidate.a === pointer.pointerId ? candidate.b : candidate.a;
      const other = map.get(otherId);
      const finalDist = other
        ? Math.hypot(e.clientX - other.x, e.clientY - other.y)
        : candidate.startDist;

      if (
        e.type !== 'pointercancel' &&
        !candidate.fired &&
        finalDist <= candidate.startDist &&
        candidate.startDist - finalDist >= PINCH_MERGE_THRESHOLD_PX
      ) {
        candidate.fired = true;
        onMergeRef.current?.(candidate.low, candidate.high);
      }
    }

    map.delete(pointer?.pointerId ?? e.pointerId);

    if (map.size < 2) {
      candidateRef.current = null;
      clipPinchState.active = false;
    }
  }, []);

  useEffect(() => {
    const handleMove = (e: PointerEvent) => {
      const pointer = pointersRef.current.get(e.pointerId);
      if (pointer) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
      }
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handlePointerEnd);
    window.addEventListener('pointercancel', handlePointerEnd);

    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handlePointerEnd);
      window.removeEventListener('pointercancel', handlePointerEnd);
      pointersRef.current.clear();
      candidateRef.current = null;
      clipPinchState.active = false;
    };
  }, [handlePointerEnd]);

  const handlePointerDown = useCallback((e: ReactPointerEvent<HTMLElement>) => {
    /*
     * Disabled while there is nothing to merge (e.g. while playing), so the
     * horizontal pan / page drag keep full control then.
     */
    if (!onMergeRef.current) return;

    if (e.pointerType === 'mouse' && e.button !== 0) {
      return;
    }

    const clipIndex = clipIndexAt(e.target);
    if (clipIndex < 0) return;

    const map = pointersRef.current;
    map.set(e.pointerId, {
      pointerId: e.pointerId,
      clipIndex,
      x: e.clientX,
      y: e.clientY,
    });

    if (map.size === 2 && !candidateRef.current) {
      const [a, b] = [...map.values()];
      candidateRef.current = {
        a: a.pointerId,
        b: b.pointerId,
        low: Math.min(a.clipIndex, b.clipIndex),
        high: Math.max(a.clipIndex, b.clipIndex),
        startDist: distance(a, b),
        fired: false,
      };
      clipPinchState.active = true;
    }
  }, []);

  return {onPointerDown: handlePointerDown};
}
