import {expect, test} from '@playwright/test';

import {
  mergeScopeCheckbox,
  openClipDetectionTab,
  seedConfig,
  setMergeScope,
  waitForClips,
} from './helpers';

/**
 * Merge scope decides whether a gesture (or the merge slider) applies to one
 * clip or the whole track, and it drives whether the slider is offered at all.
 *
 * Advanced controls are seeded on because the toolbar that owns the slider is
 * only rendered when they are enabled.
 */
test.describe('merge scope', () => {
  test('defaults to selected clip and hides the merge slider', async ({
    page,
  }) => {
    // No mergeScope seeded, so the store default decides.
    await seedConfig(page, {showAdvancedControls: true});

    await page.goto('/');
    await waitForClips(page);

    // The toolbar renders once clips exist and advanced controls are enabled.
    await expect(page.locator('.clip-toolbar')).toBeVisible();

    // Clip scope has no track-wide gap to adjust, so the slider is absent while
    // the unrelated repeat control remains.
    await expect(page.locator('.clip-merge')).toHaveCount(0);
    await expect(page.locator('.clip-reps')).toHaveCount(1);
  });

  test('shows the merge slider in whole-track scope', async ({page}) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'global'});

    await page.goto('/');
    await waitForClips(page);

    await expect(page.locator('.clip-toolbar')).toBeVisible();
    await expect(page.locator('.clip-merge')).toHaveCount(1);
  });

  test('reveals the merge slider as soon as scope switches to whole track', async ({
    page,
  }) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'clip'});

    await page.goto('/');
    await waitForClips(page);

    await expect(page.locator('.clip-merge')).toHaveCount(0);

    await openClipDetectionTab(page);
    await setMergeScope(page, 'global');

    // Settings apply instantly, so the toolbar updates without a reload.
    await expect(page.locator('.clip-merge')).toHaveCount(1);
  });

  test('hides the merge slider again when scope returns to selected clip', async ({
    page,
  }) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'global'});

    await page.goto('/');
    await waitForClips(page);

    await expect(page.locator('.clip-merge')).toHaveCount(1);

    await openClipDetectionTab(page);
    await setMergeScope(page, 'clip');

    await expect(page.locator('.clip-merge')).toHaveCount(0);
  });

  test('persists the chosen scope across a reload', async ({page}) => {
    await seedConfig(page, {showAdvancedControls: true, mergeScope: 'global'});

    await page.goto('/');
    await waitForClips(page);

    await openClipDetectionTab(page);
    await setMergeScope(page, 'clip');

    await page.reload();
    await waitForClips(page);

    // The switch is checked for "Selected clip" scope...
    await openClipDetectionTab(page);
    await expect(mergeScopeCheckbox(page)).toBeChecked();

    // ...and the slider follows it, without the seed rewriting the stored value.
    await expect(page.locator('.clip-merge')).toHaveCount(0);
  });
});
