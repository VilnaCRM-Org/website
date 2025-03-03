import { test, Locator } from '@playwright/test';
import { t } from 'i18next';

import fillForm from '../utils/fillForm';

import {
  placeholderInitials,
  placeholderEmail,
  placeholderPassword,
  signUpButton,
  policyText,
  graphqlEndpoint,
} from './constants';
import { responseFilter } from './utils';

const backToFormSuccess:string = t('notifications.success.button');

test('Show notification success component', async ({ page }) => {
  const initialsInput: Locator = page.getByPlaceholder(placeholderInitials);
  const emailInput: Locator = page.getByPlaceholder(placeholderEmail);
  const passwordInput: Locator = page.getByPlaceholder(placeholderPassword);
  const policyTextCheckbox: Locator = page.getByLabel(policyText);

  const signupButton: Locator = page.getByRole('button', {
    name: signUpButton,
  });

  await page.goto('/');

  await fillForm({ initialsInput, emailInput, passwordInput, policyTextCheckbox });

  await page.route(graphqlEndpoint, route => {
    route.fulfill();
  });

  await page.waitForResponse(responseFilter);

  await signupButton.click();


  const backToForm: Locator= page.getByRole('button', {name: backToFormSuccess});


  await backToForm.click();

});
