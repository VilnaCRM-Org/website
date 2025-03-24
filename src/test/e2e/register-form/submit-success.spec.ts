import { test, Locator, expect } from '@playwright/test';
import { t } from 'i18next';
import { Response } from 'playwright';

import { checkCheckbox } from '../utils/checkCheckbox';
import { fillInput } from '../utils/fillInput';

import { userData, graphqlEndpoint } from './constants';
import { getFormFields, responseFilter, successResponse } from './utils';

const successTitleText: string = t('notifications.success.title');
const successButtonText: string = t('notifications.success.button');
const confettiAltText: string = t('notifications.success.images.confetti');

test('Submit the registration form and verify success notification', async ({ page }) => {
  const { initialsInput, emailInput, passwordInput, policyTextCheckbox, signupButton } =
    getFormFields(page);

  await page.goto('/');

  await fillInput(initialsInput, userData.fullName);
  await fillInput(emailInput, userData.email);
  await fillInput(passwordInput, userData.password);
  await checkCheckbox(policyTextCheckbox);

  await page.route(graphqlEndpoint, successResponse);

  const responsePromise: Promise<Response> = page.waitForResponse(responseFilter);

  await signupButton.click();

  await responsePromise;

  const successTitle: Locator = page.getByText(successTitleText);
  const successConfettiImages: Locator[] = await page.getByAltText(confettiAltText).all();

  await successTitle.waitFor({ state: 'visible' });
  await successConfettiImages[0].waitFor({ state: 'visible' });
  await successConfettiImages[1].waitFor({ state: 'visible' });

  await page.getByRole('button', { name: successButtonText }).click();

  await expect(initialsInput).toBeVisible();

  await expect(initialsInput).toHaveValue('');
  await expect(emailInput).toHaveValue('');
  await expect(passwordInput).toHaveValue('');
  await expect(policyTextCheckbox).not.toBeChecked();
});
