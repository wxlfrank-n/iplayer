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