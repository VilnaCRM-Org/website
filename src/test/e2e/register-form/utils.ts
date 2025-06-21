import { Locator, Page, Response, expect, Route } from '@playwright/test';
import winston, { Logger } from 'winston';

import {
  expectationsEmail,
  expectationsPassword,
  placeholderInitials,
  placeholderEmail,
  placeholderPassword,
  signUpButton,
  graphqlEndpoint,
  requiredNameError,
  userData,
  policyText,
} from './constants';
import { User } from './types';

export async function fillInitialsInput(page: Page, user: User): Promise<void> {
  const initialsInput: Locator = page.getByPlaceholder(placeholderInitials);
  await page.getByRole('button', { name: signUpButton }).click();
  await initialsInput.fill(' ');
  await expect(page.getByText(requiredNameError).first()).toBeVisible();
  await initialsInput.fill(user.fullName);
}

export async function fillEmailInput(page: Page, user: User): Promise<void> {
  const emailInput: Locator = page.getByPlaceholder(placeholderEmail);
  await page.getByRole('button', { name: signUpButton }).click();
 for (const expectation of expectationsEmail) {
   
 
    await emailInput.fill(expectation.email);
    await expect(page.getByText(expectation.errorText)).toBeVisible();
  }
;

  await emailInput.fill(user.email);
}

export async function fillPasswordInput(page: Page, user: User): Promise<void> {
  const passwordInput: Locator = page.getByPlaceholder(placeholderPassword);
  await page.getByRole('button', { name: signUpButton }).click();
  await Promise.all(
  expectationsPassword.map(async (expectation) => {
    await passwordInput.fill(expectation.password);
    await expect(page.getByText(expectation.errorText)).toBeVisible();
  })
);

  await passwordInput.fill(user.password);
}

export function responseFilter(resp: Response): boolean {
  return resp.url().includes(graphqlEndpoint) && resp.status() === 200;
}
interface GraphQLResponse {
  errors: { message: string }[];
}

const logger: Logger = winston.createLogger({
  level: 'info',
  format: winston.format.simple(),
  transports: [new winston.transports.Console()],
});

export async function responseErrorFilter(resp: Response): Promise<boolean> {
  const contentType: string = resp.headers()['content-type'] || '';

  if (!contentType.includes('application/json')) {
    logger.warn(`Unexpected content type: ${contentType} for URL: ${resp.url()}`);
    return false;
  }
  try {
    const json: GraphQLResponse = await resp.json();
    const hasErrors: boolean = json.errors?.length > 0;

    logger.info(`Response URL: ${resp.url()}, Has Errors: ${hasErrors}`);
    return resp.url().includes(graphqlEndpoint) && hasErrors;
  } catch (error) {
    logger.warn(`Failed to parse JSON response from ${resp.url()}:`, error);
    return false;
  }
}

type GetFormFields = {
  initialsInput: Locator;
  emailInput: Locator;
  passwordInput: Locator;
  policyTextCheckbox: Locator;
  signupButton: Locator;
};

export function getFormFields(page: Page): GetFormFields {
  const initialsInput: Locator = page.getByPlaceholder(placeholderInitials);
  const emailInput: Locator = page.getByPlaceholder(placeholderEmail);
  const passwordInput: Locator = page.getByPlaceholder(placeholderPassword);
  const policyTextCheckbox: Locator = page.getByLabel(policyText);
  const signupButton: Locator = page.getByRole('button', { name: signUpButton });

  return { initialsInput, emailInput, passwordInput, policyTextCheckbox, signupButton };
}

export async function successResponse(route: Route): Promise<void> {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      data: {
        createUser: {
          user: {
            email: userData.email,
            initials: userData.fullName,
            id: '12345',
            confirmed: true,
          },
          clientMutationId: '186',
        },
      },
    }),
  });
}
