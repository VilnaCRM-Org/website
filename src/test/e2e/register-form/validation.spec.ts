import { test, Locator } from '@playwright/test';
import { t } from 'i18next';
import { Response } from 'playwright';

import { signUpButton, policyText, userData, graphqlEndpoint } from './constants';
import {
  fillEmailInput,
  fillInitialsInput,
  fillPasswordInput,
  responseFilter,
  successResponse,
} from './utils';

const confettiAltText: string = t('notifications.success.images.confetti');

test('Should display error messages for invalid inputs', async ({ page }) => {
  await page.goto('/');

  await fillInitialsInput(page, userData);
  await fillEmailInput(page, userData);
  await fillPasswordInput(page, userData);
  await page.getByLabel(policyText).check();

  await page.route(graphqlEndpoint, successResponse);
  const successResponsePromise: Promise<Response> = page.waitForResponse(responseFilter);

  await page.getByRole('button', { name: signUpButton }).click();
  await successResponsePromise;

  const successConfettiImage: Locator = page.getByAltText(confettiAltText);
  const successConfettiBottomImage: Locator = page.getByAltText(confettiAltText);

  await successConfettiImage.waitFor({ state: 'visible' });
  await successConfettiBottomImage.waitFor({ state: 'visible' });
});
