import { test, expect, Page } from '@playwright/test';

import { INTERACTION_STATES } from '../a11y/interaction-states';
import { scanInteractionState } from '../a11y/scan-interaction-state';

import { t } from './utils/initializeLocalization';

const labelButtonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');
const labelButtonToExitDrawer: string = t('header.drawer.button_aria_labels.exit');

/**
 * The open drawer is located by its `dialog` role, not by `presentation` (#369).
 * The drawer used to override the modal root's role with `menu`, which failed axe's
 * `aria-required-children`; removing the override restores MUI's default
 * `role="presentation"` on that root, so `getByRole('presentation')` would then match
 * two nodes — the modal root and the inner content Box — and die on strict mode.
 * `dialog` is both unambiguous and what an open drawer actually is: MUI puts
 * `role="dialog"` and `aria-modal="true"` on the paper.
 */
const drawerRole = 'dialog' as const;

async function openDrawer(page: Page): Promise<void> {
  await page.getByLabel(labelButtonToOpenDrawer).click();
  await expect(page.getByRole(drawerRole)).toBeVisible();
}

async function closeDrawer(page: Page): Promise<void> {
  await page.getByLabel(labelButtonToExitDrawer).click();
  await expect(page.getByRole(drawerRole)).toBeHidden();
}

test('Checking whether the drawer opens and closes', async ({ page }) => {
  await page.goto('/');
  await page.setViewportSize({ width: 450, height: 812 });

  await openDrawer(page);

  // The only scan that runs at a mobile viewport (#369). The Playwright projects
  // are desktop-only, so an open drawer is both a composed state the route scan
  // cannot reach and the one place the gate sees the mobile breakpoint at all —
  // including whether the overlaid page stays reachable by assistive technology.
  await scanInteractionState(page, INTERACTION_STATES.mobileDrawerOpen);

  await closeDrawer(page);

  await openDrawer(page);
  await page.setViewportSize({ width: 1024, height: 812 });

  await expect(page.getByRole(drawerRole)).toBeHidden();
});
