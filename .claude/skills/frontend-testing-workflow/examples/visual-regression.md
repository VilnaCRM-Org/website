# Visual Regression Example

A visual spec (`src/test/visual/`, run with `make test-visual`). Stabilize fonts
and animations before the snapshot so the diff reflects real layout change, not
flake. Baselines are committed per browser and viewport in the adjacent
`*-snapshots/` folder.

```ts
import { test, expect } from '@playwright/test';

test('sign-up success notification matches the baseline', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  // Settle fonts and animations so the pixel diff is not timing flake.
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
  await page.evaluate(() =>
    Promise.all(document.getAnimations().map(animation => animation.finished.catch(() => null)))
  );

  await expect(page).toHaveScreenshot('signup-success.png');
});
```

Real visual specs (for example `src/test/visual/visualNotificationError.spec.ts`)
loop over a `screenSizes` list and encode the locale and viewport in the file
name, such as `` `${currentLanguage}_${screen.name}_error.png` ``, so each
browser/viewport gets its own baseline.

## Updating baselines

Regenerate only after a deliberate, reviewed UI change, and inspect every
regenerated image before committing:

```bash
make test-visual-update
```

Webkit baselines can drift roughly two pixels after a Playwright upgrade.
Regenerate the affected snapshots — never raise the diff threshold or add a
per-test pixel allowance to hide the drift.
