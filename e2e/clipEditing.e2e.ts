import {expect, test, type Page} from '@playwright/test';

import {
  clipCount,
  seedConfig,
  stopPlayback,
  swipeClip,
  waitForClips,
} from './helpers';

/**
 * Open the app in the stacked view.
 *
 * Editing is asserted on clip counts. The stacked view keeps every clip in the
 * DOM, so `.waveform-clip` is the whole-track total; the row view renders only
 * the clips inside its window, which now follows the selected clip.
 */
async function gotoStacked(page: Page): Promise<void> {
  await seedConfig(page, {waveformView: 'stacked'});

  await page.goto('/');
  await waitForClips(page);
}

/** Combined length of all rendered clips, in seconds. */
async function totalClipSeconds(page: import('@playwright/test').Page) {
  const labels = await page.locator('.stacked-clip-dur').allTextContents();

  return labels.reduce((sum, text) => sum + Number.parseFloat(text), 0);
}

/**
 * Split the first clip that can be split, returning its index.
 *
 * Only a merged group can be split and a leaf ignores the up-swipe, so the
 * leading clips are tried until a swipe actually adds a clip. A successful
 * split starts playing the new piece, and gestures are disabled while playing,
 * so playback is stopped before returning to leave the track editable.
 */
async function splitAnyClip(
  page: import('@playwright/test').Page,
): Promise<number> {
  const before = await clipCount(page);

  for (let index = 0; index < 8; index++) {
    await swipeClip(page, index, 'up');

    const split = await expect
      .poll(() => clipCount(page), {timeout: 2000})
      .toBeGreaterThan(before)
      .then(
        () => true,
        () => false,
      );

    if (split) {
      await stopPlayback(page);

      return index;
    }
  }

  throw new Error('no clip could be split');
}

test.describe('merging clips', () => {
  test('merging a clip with its neighbour drops one clip', async ({page}) => {
    await gotoStacked(page);

    const before = await clipCount(page);
    const secondsBefore = await totalClipSeconds(page);

    await swipeClip(page, 1, 'down');

    await expect.poll(() => clipCount(page)).toBe(before - 1);

    // A merge bridges exactly one silence gap, so the covered audio changes by
    // well under a second (labels are rounded to 0.1s, hence the slack).
    expect(
      Math.abs((await totalClipSeconds(page)) - secondsBefore),
    ).toBeLessThan(1);
  });

  test('the merge slider merges clips in whole-track scope', async ({page}) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'global'});
    await page.goto('/');
    await waitForClips(page);

    await expect(page.locator('.clip-merge')).toHaveCount(1);

    const before = await clipCount(page);

    await page.getByRole('button', {name: 'Merge more clips'}).click();

    await expect.poll(() => clipCount(page)).toBe(before - 1);
  });

  test('the merge slider splits groups back apart', async ({page}) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'global'});
    await page.goto('/');
    await waitForClips(page);

    const before = await clipCount(page);

    await page.getByRole('button', {name: 'Merge fewer clips'}).click();

    await expect.poll(() => clipCount(page)).toBeGreaterThan(before);
  });
});

test.describe('splitting clips', () => {
  test('splitting a merged clip adds one clip', async ({page}) => {
    await gotoStacked(page);

    const before = await clipCount(page);
    const secondsBefore = await totalClipSeconds(page);

    await splitAnyClip(page);

    await expect.poll(() => clipCount(page)).toBe(before + 1);

    // Splitting cuts at one internal gap, so again only a fraction of a second
    // of covered audio changes.
    expect(
      Math.abs((await totalClipSeconds(page)) - secondsBefore),
    ).toBeLessThan(1);
  });

  test('split and merge round-trip restores the clip count', async ({page}) => {
    await gotoStacked(page);

    const before = await clipCount(page);

    const index = await splitAnyClip(page);
    await expect.poll(() => clipCount(page)).toBe(before + 1);

    // Merging is also gesture-only, so the swipe that created the pair reverses
    // it.
    await swipeClip(page, index, 'down');
    await expect.poll(() => clipCount(page)).toBe(before);
  });
});
