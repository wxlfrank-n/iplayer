/**
 * Animation frame scheduling helpers.
 *
 * Several components and hooks own a loop that redraws on every animation
 * frame for as long as they are mounted. Centralizing the schedule/cancel
 * bookkeeping here leaves each caller with only its frame body.
 */

/**
 * Runs `onFrame` on every animation frame until the returned function is called.
 *
 * The next frame is scheduled before the body runs, so an early return or a
 * throw inside `onFrame` cannot silently kill the loop.
 *
 * @param onFrame Frame body, called once per animation frame.
 * @returns Cleanup that cancels the pending frame; call it from effect cleanup.
 */
export function startFrameLoop(onFrame: () => void): () => void {
  let handle = 0;
  const frame = () => {
    handle = requestAnimationFrame(frame);
    onFrame();
  };
  handle = requestAnimationFrame(frame);
  return () => cancelAnimationFrame(handle);
}
