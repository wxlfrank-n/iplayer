export function getWindowSecs(width: number): number {
  if (width >= 1600) return 32;
  if (width >= 1200) return 16;
  if (width >= 800) return 12;
  return 8;
}

export function clampWindowAnchor(anchor: number, maxStart: number): number {
  return Math.max(0, Math.min(anchor, maxStart));
}
