import {expect, test} from '@playwright/test';

import {flipWaveformView, waitForClips} from './helpers';

/**
 * The two waveform views render different trees from the same clip list, and
 * the page-flip control is the only way to move between them.
 */
test.describe('waveform views', () => {
  test('starts in the row view', async ({page}) => {
    await page.goto('/');
    await waitForClips(page);

    await expect(page.locator('.row-waveform')).toBeVisible();
    await expect(page.locator('.stacked-waveform')).toHaveCount(0);
  });

  test('flips to the stacked view and back', async ({page}) => {
    await page.goto('/');
    await waitForClips(page);

    await flipWaveformView(page);

    await expect(page.locator('.stacked-waveform')).toBeVisible();
    await expect(page.locator('.row-waveform')).toHaveCount(0);

    // Stacked renders one row per clip group.
    await expect(page.locator('.stacked-waveform__row').first()).toBeVisible();

    await flipWaveformView(page);

    await expect(page.locator('.row-waveform')).toBeVisible();
    await expect(page.locator('.stacked-waveform')).toHaveCount(0);
  });

  test('remembers the chosen view across a reload', async ({page}) => {
    await page.goto('/');
    await waitForClips(page);

    await flipWaveformView(page);
    await expect(page.locator('.stacked-waveform')).toBeVisible();

    await page.reload();
    await waitForClips(page);

    await expect(page.locator('.stacked-waveform')).toBeVisible();
  });
});
