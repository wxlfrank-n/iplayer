import {expect, type Page} from '@playwright/test';

/** localStorage key holding the persisted app config (see configSlice). */
export const CONFIG_KEY = 'Listeenoop_config';

/**
 * Seed the persisted config before the app boots.
 *
 * The store reads localStorage once, at module load, so anything written after
 * the first render is ignored. `addInitScript` runs before any page script,
 * which is the only point where seeding actually takes effect.
 *
 * Seeding is skipped once a value exists. `addInitScript` re-runs on every
 * navigation, including reloads, so an unconditional write would silently
 * clobber whatever the app persisted and make persistence untestable.
 */
export async function seedConfig(
  page: Page,
  config: Record<string, unknown>,
): Promise<void> {
  await page.addInitScript(
    ([key, value]) => {
      if (!window.localStorage.getItem(key as string)) {
        window.localStorage.setItem(key as string, value as string);
      }
    },
    [CONFIG_KEY, JSON.stringify(config)] as const,
  );
}

/**
 * Open Settings and switch to the "Clip detection" tab.
 */
export async function openClipDetectionTab(page: Page): Promise<void> {
  // `exact` matters: the toolbar has a "Merge more clips" button, which a
  // substring match on "More" would also select.
  await page.getByRole('button', {name: 'More', exact: true}).click();
  await page.getByRole('menuitem', {name: 'Settings'}).click();

  await expect(page.getByRole('tabpanel')).toBeVisible();

  await page.getByRole('tab', {name: 'Clip detection'}).click();
}

/**
 * The "Selected clip" merge-scope control inside the clip detection tab.
 *
 * Located by its visible label rather than a test id: it is a real checkbox
 * wrapped in a label, so the label text is the stable handle.
 */
export function mergeScopeSwitch(page: Page) {
  return page
    .getByRole('tabpanel')
    .locator('.settings-switch', {hasText: 'Selected clip'});
}

/** The underlying checkbox, for asserting state. */
export function mergeScopeCheckbox(page: Page) {
  return mergeScopeSwitch(page).locator('input[type="checkbox"]');
}

/**
 * Set the merge scope by clicking, the way a user does.
 *
 * The checkbox is visually hidden beneath the styled `.settings-switch__track`
 * span, so Playwright refuses to click it directly; the wrapping label is the
 * real hit target. Clicks only when the value actually differs, so this is
 * safe to call when the scope is already correct.
 */
export async function setMergeScope(
  page: Page,
  scope: 'clip' | 'global',
): Promise<void> {
  const toggle = mergeScopeSwitch(page);

  if ((await mergeScopeCheckbox(page).isChecked()) === (scope === 'clip')) {
    return;
  }

  await toggle.click();
}

/**
 * Turn the page-flip animation over to the other waveform view.
 *
 * The button ignores clicks while a turn is in flight (the animation masks the
 * view change), so wait for the previous turn to settle first, otherwise the
 * click is silently dropped. Waiting on the class avoids hardcoding timings.
 */
export async function flipWaveformView(page: Page): Promise<void> {
  const flip = page.locator('.waveform-view-flip');

  await expect(flip).not.toHaveClass(/waveform-view-flip--flipping/);

  await flip.click();
}

/**
 * Wait for the default track to be decoded and split into clips.
 *
 * Returns once at least one clip is on screen, which is the first point the
 * whole pipeline (fetch -> decode -> analyse -> render) has demonstrably run.
 */
export async function waitForClips(page: Page): Promise<void> {
  await expect(page.locator('.waveform-clip').first()).toBeVisible();
}

/** The transport play/pause button. */
export function playButton(page: Page) {
  return page.locator('.control-btn--play');
}

/**
 * Capture the media element the app creates so tests can read `currentTime`.
 *
 * The element is built in JavaScript and never attached to the document, so it
 * cannot be queried with a locator; intercepting `play()` is the only way to
 * get a handle on it. Call before the first navigation.
 */
export async function hookMedia(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const originalPlay = HTMLMediaElement.prototype.play;

    HTMLMediaElement.prototype.play = function (
      this: HTMLMediaElement,
      ...args
    ) {
      (window as unknown as {__media?: HTMLMediaElement}).__media = this;

      return originalPlay.apply(this, args);
    };
  });
}

/** Current playback position, or null before anything has been played. */
export function mediaTime(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const media = (window as unknown as {__media?: HTMLMediaElement})
      .__media as HTMLMediaElement | undefined;

    return media ? media.currentTime : null;
  });
}

/** Total media duration, or null before anything has been played. */
export function mediaDuration(page: Page): Promise<number | null> {
  return page.evaluate(() => {
    const media = (window as unknown as {__media?: HTMLMediaElement})
      .__media as HTMLMediaElement | undefined;

    return media ? media.duration : null;
  });
}

/** Number of clips currently rendered. */
export function clipCount(page: Page): Promise<number> {
  return page.locator('.waveform-clip').count();
}

/**
 * Make a clip the active one so its split/merge actions become available.
 *
 * Clicking a clip both activates and plays it, and clip gestures are disabled
 * while playing (`onSwipeClip` is withheld), so playback has to be stopped
 * before the actions appear.
 */
export async function activateClip(page: Page, index: number): Promise<void> {
  await page.locator('.waveform-clip').nth(index).click();

  await stopPlayback(page);
}

/** Stop playback if it is running. */
export async function stopPlayback(page: Page): Promise<void> {
  const play = playButton(page);

  // A very short clip can start and finish between the click and this check,
  // so playback is not assumed to be running.
  await expect(play).toHaveAttribute('aria-label', /^(Pause|Play)$/);

  if ((await play.getAttribute('aria-label')) === 'Pause') {
    await play.click();
  }

  await expect(play).toHaveAttribute('aria-label', 'Play');
}

/**
 * Click a clip's split or merge action, activating clips until one offers it.
 *
 * Availability depends on the clip (only a group can be split, and the last
 * remaining clip has nothing to merge with), so the first clip offering the
 * action is used rather than a hardcoded index. Returns the index used.
 */
export async function clickClipAction(
  page: Page,
  action: 'merge' | 'split',
): Promise<number> {
  const count = await clipCount(page);

  for (let index = 0; index < Math.min(count, 6); index++) {
    await activateClip(page, index);

    const button = page.locator(`.stacked-clip-action--${action}`);

    if ((await button.count()) > 0) {
      await button.click();

      return index;
    }
  }

  throw new Error(`no clip offered a "${action}" action`);
}

/** Absolute start/end times of a rendered clip, from the row view overlay. */
function clipBounds(page: Page, index: number) {
  return page.evaluate(i => {
    const labels = document.querySelectorAll('[data-clip-start]');
    const el = labels[i];

    if (!el) return null;

    return {
      start: Number(el.getAttribute('data-clip-start')),
      end: Number(el.getAttribute('data-clip-end')),
    };
  }, index);
}

/**
 * Start playback and wait until the media element reports real progress.
 *
 * Waiting on `currentTime` rather than on a fixed delay keeps the tests fast
 * and independent of decode/analysis timing.
 */
export async function playAndAdvance(page: Page, ms = 600): Promise<number> {
  await playButton(page).click();
  await expect(playButton(page)).toHaveAttribute('aria-label', 'Pause');

  const start = await mediaTime(page);

  await expect
    .poll(async () => (await mediaTime(page)) ?? 0, {timeout: 10_000})
    .toBeGreaterThan((start ?? 0) + ms / 1000);

  return (await mediaTime(page)) as number;
}

/** The stacked view's "current / total" page indicator. */
export function pageIndicator(page: Page) {
  return page.locator('.stacked-waveform__pageno');
}

/** Current and total page counts of the stacked pager. */
async function pageCounts(
  page: Page,
): Promise<{current: number; total: number}> {
  const text = ((await pageIndicator(page).textContent()) ?? '').trim();
  const [current, total] = text.split('/').map(part => Number(part.trim()));

  return {current, total};
}

export {pageCounts, clipBounds};

/** Seek forward with the transport skip button, `times` clicks. */
export async function skipForward(page: Page, times = 1): Promise<void> {
  for (let i = 0; i < times; i++) {
    await page.getByRole('button', {name: /Go forward \d+ seconds/}).click();
  }
}
