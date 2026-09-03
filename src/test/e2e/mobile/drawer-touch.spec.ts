// Lives under src/test/e2e/mobile because every interaction here is a real
// finger: `locator.tap()` throws unless the context was created with
// `hasTouch`, which only the `mobile-chrome` project sets. A desktop project
// resized to 412px would fake the layout but not the input, so a burger that
// only ever responded to a click would still pass there.
import { test, expect, Locator, Page } from '@playwright/test';

import { t } from '../utils/initializeLocalization';

const openDrawerLabel: string = t('header.drawer.button_aria_labels.bars');
const closeDrawerLabel: string = t('header.drawer.button_aria_labels.exit');
const advantagesLink: string = t('header.advantages');
const vilnaCRMEmail: string = t('footer.vilna_email');

// MUI gives a temporary Drawer's paper `role="dialog"`. The Modal root around it
// carries this app's `role="menu"` and an inner Box is `role="presentation"`, so
// `getByRole('presentation')` is ambiguous here (it resolves to two elements).
function drawerPanel(page: Page): Locator {
  return page.getByRole('dialog');
}

async function tapBurger(page: Page): Promise<void> {
  await page.getByLabel(openDrawerLabel).tap();
  await expect(drawerPanel(page)).toBeVisible();
}

test.describe('Drawer on a touch device', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The header is a `ssr: false` dynamic import, so wait for the burger rather
    // than for load: only then is "the drawer is closed" a real assertion.
    await expect(page.getByLabel(openDrawerLabel)).toBeVisible({ timeout: 15000 });
  });

  test('tapping the burger opens the drawer and exposes its own content', async ({ page }) => {
    await expect(drawerPanel(page)).toBeHidden();
    await expect(page.getByLabel(closeDrawerLabel)).toBeHidden();

    await tapBurger(page);

    const panel: Locator = drawerPanel(page);
    await expect(panel.getByLabel(closeDrawerLabel)).toBeVisible();
    await expect(panel.getByRole('link', { name: advantagesLink })).toBeVisible();
    await expect(panel.getByRole('link', { name: vilnaCRMEmail })).toHaveAttribute(
      'href',
      `mailto:${vilnaCRMEmail}`
    );
  });

  test('tapping a drawer link navigates and closes the drawer', async ({ page }) => {
    await tapBurger(page);

    await drawerPanel(page).getByRole('link', { name: advantagesLink }).tap();

    await expect(page).toHaveURL(/#Advantages$/);
    await expect(drawerPanel(page)).toBeHidden();
  });

  test('tapping the close control closes the drawer without navigating', async ({ page }) => {
    const urlBeforeOpening: string = page.url();

    await tapBurger(page);
    await page.getByLabel(closeDrawerLabel).tap();

    await expect(drawerPanel(page)).toBeHidden();
    await expect(page.getByLabel(openDrawerLabel)).toBeVisible();
    expect(page.url()).toBe(urlBeforeOpening);
  });

  test('the page behind the open drawer is hidden from assistive technology', async ({ page }) => {
    // `#__next` is the Next.js pages-router root and the only body child holding
    // the app, so it is the element MUI's ModalManager marks while a modal is up.
    const appRoot: Locator = page.locator('#__next');

    await expect(appRoot).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('main')).toBeVisible();

    await tapBurger(page);

    // The drawer is portalled next to the app root, and ModalManager aria-hides
    // every sibling of it. That is what keeps the drawer's nav and social links
    // from colliding with the identical header and footer links in role queries.
    await expect(appRoot).toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('main')).toBeHidden();

    await page.getByLabel(closeDrawerLabel).tap();

    await expect(appRoot).not.toHaveAttribute('aria-hidden', 'true');
    await expect(page.getByRole('main')).toBeVisible();
  });
});
