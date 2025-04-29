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

  const successConfettiImage: Locator = page.getByAltText(confettiAltText);
  const successConfettiBottomImage: Locator = page.getByAltText(confettiAltText);

  await successConfettiImage.waitFor({ state: 'attached' });
  await successConfettiBottomImage.waitFor({ state: 'attached' });

  await expect(successConfettiImage).toBeAttached();
  await expect(successConfettiBottomImage).toBeAttached();
});
