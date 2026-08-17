import { test, expect, Locator } from '@playwright/test';
import { t } from 'i18next';
import { Response } from 'playwright';

import { INTERACTION_STATES } from '../../a11y/interaction-states';
import { scanInteractionState } from '../../a11y/scan-interaction-state';

import {
  signUpButton,
  policyText,
  requiredNameError,
  userData,
  graphqlEndpoint,
} from './constants';
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

  // This journey's first action is a submit with an empty form, which renders
  // exactly the state axe cannot otherwise reach (#369): the required-field
  // messages are conditional DOM, invisible to static jsx-a11y lint and absent
  // from the initial-load route scan. Scanning here asserts the error messages
  // are actually associated with the fields they describe.
  await page.getByRole('button', { name: signUpButton }).click();
  await expect(page.getByText(requiredNameError).first()).toBeVisible();
  await scanInteractionState(page, INTERACTION_STATES.registrationValidationErrors);

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
