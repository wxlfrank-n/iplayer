import {expect, test} from '@playwright/test';

import {waitForClips} from './helpers';

/**
 * The app boots on a bundled track, so these cover the pipeline that jsdom
 * cannot: fetching the MP3, decoding it through the Web Audio API, analysing
 * the samples into clips, and drawing them.
 */
test.describe('startup', () => {
  test('decodes the default track and renders its clips', async ({page}) => {
    await page.goto('/');

    await expect(page.getByText('01A').first()).toBeVisible();

    await waitForClips(page);

    // The waveform canvas must exist and be laid out.
    const canvas = page.locator('canvas.row-waveform__svg').first();
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box?.width ?? 0).toBeGreaterThan(0);
    expect(box?.height ?? 0).toBeGreaterThan(0);
  });

  test('does not report a waveform error for the bundled track', async ({
    page,
  }) => {
    await page.goto('/');

    await waitForClips(page);

    await expect(page.locator('.waveform-loading--error')).toHaveCount(0);
  });

  test('labels every detected clip with an index', async ({page}) => {
    await page.goto('/');

    await waitForClips(page);

    // ClipLabel renders its index badge; a detected clip must have one.
    await expect(page.locator('.stacked-clip-label').first()).toBeVisible();
  });
});
