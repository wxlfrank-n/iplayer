import type { Clip } from "./clips";

/**
 * Clamped window anchor after dragging by `dx` pixels. Dragging right (positive
 * `dx`) shows earlier audio; dragging left shows later.
 */
export function panTarget(
  startAnchor: number,
  dx: number,
  winLen: number,
  clientWidth: number,
  maxStart: number,
): number {
  const secPerPx = (winLen || 1) / (clientWidth || 1);
  return Math.max(0, Math.min(startAnchor - dx * secPerPx, maxStart));
}

/**
 * Index of the clip whose start is nearest `anchor`; -1 when there are no clips.
 */
export function nearestClipIndex(clips: Clip[], anchor: number): number {
  if (clips.length === 0) return -1;
  let best = 0;
  let bestDist = Infinity;
  for (let i = 0; i < clips.length; i++) {
    const d = Math.abs(clips[i].vStart - anchor);
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/**
 * End-of-drag decision: keep the panned anchor exactly where the user left it
 * (a merged clip's start may sit behind the finger, so snapping the window back
 * to the nearest clip start made touch pans visibly spring back on release) and
 * only select the clip under the anchor.
 */
export function endPan(
  anchor: number,
  clips: Clip[],
): { anchor: number; index: number } {
  return { anchor, index: nearestClipIndex(clips, anchor) };
}