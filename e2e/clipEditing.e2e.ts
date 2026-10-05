import {expect, test} from '@playwright/test';

import {
  clickClipAction,
  clipCount,
  seedConfig,
  stopPlayback,
  waitForClips,
} from './helpers';

/** Combined length of all rendered clips, in seconds. */
async function totalClipSeconds(page: import('@playwright/test').Page) {
  const labels = await page.locator('.stacked-clip-dur').allTextContents();

  return labels.reduce((sum, text) => sum + Number.parseFloat(text), 0);
}

test.describe('merging clips', () => {
  test('merging the active clip with its neighbour drops one clip', async ({
    page,
  }) => {
    await page.goto('/');
    await waitForClips(page);

    const before = await clipCount(page);
    const secondsBefore = await totalClipSeconds(page);

    await clickClipAction(page, 'merge');

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
  test('splitting the active clip adds one clip', async ({page}) => {
    await page.goto('/');
    await waitForClips(page);

    const before = await clipCount(page);
    const secondsBefore = await totalClipSeconds(page);

    await clickClipAction(page, 'split');

    await expect.poll(() => clipCount(page)).toBe(before + 1);

    // Splitting cuts at one internal gap, so again only a fraction of a second
    // of covered audio changes.
    expect(
      Math.abs((await totalClipSeconds(page)) - secondsBefore),
    ).toBeLessThan(1);
  });

  test('split and merge round-trip restores the clip count', async ({page}) => {
    await page.goto('/');
    await waitForClips(page);

    const before = await clipCount(page);

    await clickClipAction(page, 'split');
    await expect.poll(() => clipCount(page)).toBe(before + 1);

    // Stop before editing so the actions are offered again.
    await stopPlayback(page);

    await clickClipAction(page, 'merge');
    await expect.poll(() => clipCount(page)).toBe(before);
  });
});
