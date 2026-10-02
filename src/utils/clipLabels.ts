/**
 * Clip label positioning helpers.
 *
 * Clip labels are absolutely positioned inside the waveform track, which is
 * moved imperatively (no React render per animation frame), so the labels are
 * repositioned imperatively as well.
 */

/**
 * Centers each clip label within the visible part of its clip.
 *
 * Labels that do not fit entirely inside the visible slice of their clip are
 * skipped, since there is no position that shows them without clipping.
 *
 * @param layer Element holding the `[data-row-clip-label]` wrappers.
 * @param anchor Seconds at the left edge of the viewport.
 * @param win Seconds visible in the viewport.
 * @param pxPerSec Scale used to convert a label's pixel width into seconds.
 */
export function positionClipLabels(
  layer: HTMLElement | null | undefined,
  anchor: number,
  win: number,
  pxPerSec: number,
): void {
  if (!layer || !(pxPerSec > 0)) return;
  layer
    .querySelectorAll<HTMLElement>('[data-row-clip-label]')
    .forEach(label => {
      const start = Number(label.dataset.clipStart);
      const end = Number(label.dataset.clipEnd);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start)
        return;
      const visibleStart = Math.max(start, anchor);
      const visibleEnd = Math.min(end, anchor + win);
      if (visibleEnd <= visibleStart) return;
      const labelWidthSec =
        ((label.firstChild as HTMLElement)?.getBoundingClientRect().width *
          1.1 || 0) / pxPerSec; // Convert to seconds
      let labelTime = (visibleStart + visibleEnd) / 2;
      if (end - start < labelWidthSec) {
        labelTime = (start + end) / 2;
      } else if (start + labelWidthSec > visibleEnd && end > visibleEnd) {
        labelTime = start + labelWidthSec / 2;
      } else if (visibleStart + labelWidthSec > end && start < visibleStart) {
        labelTime = end - labelWidthSec / 2;
      }
      label.style.left = `${((labelTime - start) / (end - start)) * 100}%`;
    });
}
