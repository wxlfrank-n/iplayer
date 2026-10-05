import {expect, test} from '@playwright/test';

import {
  flipWaveformView,
  hookMedia,
  mediaTime,
  pageCounts,
  pageIndicator,
  playButton,
  skipForward,
  waitForClips,
} from './helpers';

/**
 * A short viewport packs fewer rows onto each page, which produces many pages
 * and short page spans. That keeps the paging and auto-scroll tests quick:
 * the playhead only has to advance a couple of seconds to cross a boundary.
 */
test.use({viewport: {width: 1280, height: 360}});

/** Horizontal offset of the stacked pager. */
function scrollLeft(page: import('@playwright/test').Page): Promise<number> {
  return page.locator('.stacked-waveform').evaluate(el => el.scrollLeft);
}

/** Scroll the pager sideways by a pixel offset. */
function scrollPager(page: import('@playwright/test').Page, left: number) {
  return page
    .locator('.stacked-waveform')
    .evaluate((el, x) => el.scrollTo({left: x}), left);
}

/** Open the stacked view and wait for the flip animation to settle. */
async function openStackedView(page: import('@playwright/test').Page) {
  await waitForClips(page);
  await flipWaveformView(page);

  /*
   * The flip scrolls the pager, and a scroll marks the view as
   * user-scrolled, which suppresses auto-scroll for 1.5s. Waiting it out also
   * guarantees the button is clickable for the next turn.
   */
  await expect(page.locator('.waveform-view-flip')).not.toHaveClass(
    /waveform-view-flip--flipping/,
  );
  await page.waitForTimeout(1600);
}

test.describe('stacked view scrolling', () => {
  test('paginates the clip rows and reports the page number', async ({
    page,
  }) => {
    await page.goto('/');
    await openStackedView(page);

    const {current, total} = await pageCounts(page);

    expect(current).toBe(1);
    expect(total).toBeGreaterThan(1);

    // Rows are split across several pages rather than stacked in one column.
    await expect(page.locator('.stacked-waveform__page')).toHaveCount(total);
    expect(await scrollLeft(page)).toBe(0);
  });

  test('scrolling the pager moves to the next page', async ({page}) => {
    await page.goto('/');
    await openStackedView(page);

    const {current, total} = await pageCounts(page);
    const width = await page
      .locator('.stacked-waveform')
      .evaluate(el => el.clientWidth);

    await scrollPager(page, width);

    await expect
      .poll(() => pageCounts(page))
      .toMatchObject({
        current: current + 1,
      });

    expect(await scrollLeft(page)).toBeGreaterThan(0);
    expect(await scrollLeft(page)).toBeLessThanOrEqual(width * (total - 1));
  });

  test('seeking forward scrolls to the page holding the new position', async ({
    page,
  }) => {
    await hookMedia(page);
    await page.goto('/');
    await openStackedView(page);

    const {current, total} = await pageCounts(page);

    // Play once so the media element exists and the seek has a clock to move.
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');

    // Step forward until the playhead leaves the first page.
    for (let i = 0; i < total + 2; i++) {
      if ((await pageCounts(page)).current > current) break;

      await skipForward(page);
      await page.waitForTimeout(150);
    }

    await expect
      .poll(() => pageCounts(page).then(p => p.current))
      .toBeGreaterThan(current);

    expect(await scrollLeft(page)).toBeGreaterThan(0);
  });
});

test.describe('auto-scroll during playback', () => {
  test('follows the playhead into the next page without user scrolling', async ({
    page,
  }) => {
    await hookMedia(page);
    await page.goto('/');
    await openStackedView(page);

    const {current, total} = await pageCounts(page);
    expect(total).toBeGreaterThan(1);

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');

    /*
     * Jump most of the way to the end of the current page. Every seek stays
     * inside this page, so the page can only change because playback carried
     * the playhead across the boundary.
     */
    for (let i = 0; i < total + 2; i++) {
      const time = await mediaTime(page);

      if ((time ?? 0) > 4) break;

      await skipForward(page);
      await page.waitForTimeout(150);
    }

    // Still on the starting page: the seeks alone did not scroll it.
    expect((await pageCounts(page)).current).toBe(current);

    await expect
      .poll(() => pageCounts(page).then(p => p.current), {timeout: 30_000})
      .toBeGreaterThan(current);

    expect(await scrollLeft(page)).toBeGreaterThan(0);
  });

  test('keeps scrolling forward as playback continues', async ({page}) => {
    await hookMedia(page);
    await page.goto('/');
    await openStackedView(page);

    const {total} = await pageCounts(page);

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');

    // Ride the playhead across two consecutive boundaries, which proves the
    // view keeps following rather than advancing only once.
    await expect
      .poll(() => pageCounts(page).then(p => p.current), {timeout: 90_000})
      .toBeGreaterThanOrEqual(Math.min(3, total));

    expect(await scrollLeft(page)).toBeGreaterThan(0);
  });

  test('does not auto-scroll while paused', async ({page}) => {
    await hookMedia(page);
    await page.goto('/');
    await openStackedView(page);

    const {current} = await pageCounts(page);

    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');
    await skipForward(page);
    await playButton(page).click();
    await expect(playButton(page)).toHaveAttribute('aria-label', 'Play');

    const left = await scrollLeft(page);

    await page.waitForTimeout(2500);

    // Paused with no interaction, so nothing should move.
    expect((await pageCounts(page)).current).toBe(current);
    expect(await scrollLeft(page)).toBe(left);
    await expect(pageIndicator(page)).toBeVisible();
  });
});
