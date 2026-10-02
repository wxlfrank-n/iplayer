/**
 * Waveform strip style helpers.
 *
 * The strip (the rendered buffer) and the played overlay are moved and clipped
 * imperatively in the same animation frame as the viewport, so their styles are
 * written imperatively as well.
 */

/**
 * How much of the rendered buffer the playhead has covered, as a 0..1 fraction.
 *
 * @param time Playhead position in seconds.
 * @param bufferStart Seconds at the left edge of the rendered buffer.
 * @param bufferLen Seconds covered by the rendered buffer.
 */
export function playedFraction(
  time: number,
  bufferStart: number,
  bufferLen: number,
): number {
  return bufferLen > 0 ? (time - bufferStart) / bufferLen : 0;
}

/**
 * Sizes the strip to the rendered buffer and scrolls it to the viewport.
 *
 * The strip is wider than the viewport so waveform peaks outside the viewport
 * stay mounted; only its transform moves.
 *
 * @param track Strip element.
 * @param anchor Seconds at the left edge of the viewport.
 * @param windowLength Seconds visible in the viewport.
 * @param pxPerSec Scale used to convert seconds into buffer pixels.
 * @param bufferStart Seconds at the left edge of the rendered buffer.
 * @param bufferLen Seconds covered by the rendered buffer.
 */
export function updateTrackStyle(
  track: HTMLElement | null | undefined,
  anchor: number,
  windowLength: number,
  pxPerSec: number,
  bufferStart: number,
  bufferLen: number,
): void {
  if (!track) return;
  track.style.width = `${(bufferLen / windowLength) * 100}%`;
  const trackX = -(anchor - bufferStart) * pxPerSec;
  track.style.transform = `translate3d(${trackX}px, 0, 0)`;
}

/**
 * Clips the played overlay to the part of the buffer the playhead has covered.
 *
 * @param played Played overlay element.
 * @param time Playhead position in seconds.
 * @param bufferStart Seconds at the left edge of the rendered buffer.
 * @param bufferLen Seconds covered by the rendered buffer.
 */
export function updatePlayedStyle(
  played: HTMLElement | null | undefined,
  time: number,
  bufferStart: number,
  bufferLen: number,
): void {
  if (!played) return;
  const pct = Math.max(
    0,
    Math.min(100, playedFraction(time, bufferStart, bufferLen) * 100),
  );
  played.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
}
