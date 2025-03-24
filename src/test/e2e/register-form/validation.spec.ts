import { test, expect, Locator } from '@playwright/test';
import { t } from 'i18next';

import { signUpButton, policyText, userData } from './constants';
import { fillEmailInput, fillInitialsInput, fillPasswordInput } from './utils';

const confettiAltText: string = t('notifications.success.images.confetti');

test('Should display error messages for invalid inputs', async ({ page }) => {
  await page.goto('/');

  await fillInitialsInput(page, userData);
  await fillEmailInput(page, userData);
  await fillPasswordInput(page, userData);
  await page.getByLabel(policyText).check();

  await page.getByRole('button', { name: signUpButton }).click();

  const notifications: Locator[] = await page.getByAltText(confettiAltText).all();
  await notifications[0].waitFor({ state: 'attached' });
  await notifications[1].waitFor({ state: 'attached' });

  await expect(notifications[0]).toBeAttached();
  await expect(notifications[1]).toBeAttached();
});
