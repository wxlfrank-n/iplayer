/**
 * Playhead cursor style helpers.
 *
 * Like the clip labels, the cursor lives inside the waveform track and is moved
 * imperatively in the same animation frame as the viewport, so its styles are
 * written imperatively as well.
 */

/** Keeps a pinned time label clear of the cursor marker at a viewport edge. */
const LABEL_EDGE_OFFSET_PX = 6;

/** Fraction of the viewport at which a time label is pinned to that edge. */
const LABEL_EDGE_FRACTION = 0.02;

/** Tolerance used to treat two times as the same instant. */
const TIME_EPSILON = 1e-6;

type CursorEdge = 'left' | 'right' | null;

/**
 * Places the playhead cursor and its time label for the current frame.
 *
 * When the playhead is outside the viewport it is pinned to the nearest edge,
 * and its label is flipped inwards so the time stays readable. Inside the
 * viewport the label is centered on the cursor, unless it would overflow an
 * edge, in which case it is pinned just inside it.
 *
 * @param cursor Cursor element; its first child is the time label.
 * @param time Playhead position in seconds.
 * @param anchor Seconds at the left edge of the viewport.
 * @param windowLength Seconds visible in the viewport.
 * @param pxPerSec Scale used to convert seconds into buffer pixels.
 * @param bufferStart Seconds at the left edge of the rendered buffer.
 * @param waveformDuration Total track length in seconds.
 */
export function updateCursorStyle(
  cursor: HTMLElement | null | undefined,
  time: number,
  anchor: number,
  windowLength: number,
  pxPerSec: number,
  bufferStart: number,
  waveformDuration: number,
): void {
  if (!cursor) return;
  const viewportStart = anchor;
  const viewportEnd = Math.min(waveformDuration, anchor + windowLength);
  let cursorTime = time;
  let cursorEdge: CursorEdge = null;
  if (time < viewportStart) {
    cursorTime = viewportStart;
    cursorEdge = 'left';
  } else if (time > viewportEnd) {
    cursorTime = viewportEnd;
    cursorEdge = 'right';
  } else if (
    Math.abs(time - waveformDuration) < TIME_EPSILON &&
    Math.abs(viewportEnd - waveformDuration) < TIME_EPSILON
  ) {
    // The playhead is at the very end and the viewport ends there too, so the
    // marker has to sit inside instead of overflowing past the track.
    cursorTime = viewportEnd;
    cursorEdge = 'right';
  }

  let cursorX = (cursorTime - bufferStart) * pxPerSec;
  if (cursorEdge === 'right') {
    cursorX -= cursor.offsetWidth;
  }
  cursor.style.left = '0';
  cursor.style.transform = `translate3d(${cursorX}px, 0, 0)`;

  const label = cursor.firstElementChild as HTMLElement | null;
  if (!label) return;
  const pinLeft = () => {
    label.style.left = `${LABEL_EDGE_OFFSET_PX}px`;
    label.style.right = 'auto';
    label.style.transform = 'translateX(0)';
  };
  const pinRight = () => {
    label.style.left = 'auto';
    label.style.right = `${LABEL_EDGE_OFFSET_PX}px`;
    label.style.transform = 'translateX(0)';
  };

  if (cursorEdge === 'left') {
    pinLeft();
  } else if (cursorEdge === 'right') {
    pinRight();
  } else {
    const viewFraction = (time - viewportStart) / windowLength;
    if (viewFraction <= LABEL_EDGE_FRACTION) {
      pinLeft();
    } else if (viewFraction >= 1 - LABEL_EDGE_FRACTION) {
      pinRight();
    } else {
      label.style.left = 'auto';
      label.style.right = 'auto';
      label.style.transform = 'translateX(-50%)';
    }
  }
}
