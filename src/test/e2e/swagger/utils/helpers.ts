import { expect, Locator, Page } from '@playwright/test';

import { errorMessages, executeBtnSelector } from './constants';

import {
  getLocators,
  getUserEndpoints,
  GetUserEndpoints,
  SwaggerLocators,
  SwaggerPageObjects,
  TEST_CONSTANTS,
} from './index';

export async function clearEndpointResponse(endpoint: Locator): Promise<void> {
  const clearButton: Locator = endpoint.locator('button.btn-clear');
  const curl: Locator = endpoint.locator('.curl-command');

  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(curl).not.toBeVisible();
}

export async function initSwaggerPage(page: Page): Promise<SwaggerPageObjects> {
  await page.goto(TEST_CONSTANTS.SWAGGER_PATH);

  const userEndpoints: GetUserEndpoints = getUserEndpoints(page);
  const elements: SwaggerLocators = getLocators(page);

  return { userEndpoints, elements };
}

export const getAndCheckExecuteBtn: (element: Locator) => Promise<Locator> = async (
  element: Locator
): Promise<Locator> => {
  const executeBtn: Locator = element.locator(executeBtnSelector);
  await executeBtn.waitFor({ state: 'visible' });

  return executeBtn;
};

interface ErrorResponse {
  error: string;
  message: string;
  code: string;
  details?: {
    [key: string]: string;
  };
}

export async function interceptWithErrorResponse(
  page: Page,
  url: string,
  errorResponse: ErrorResponse,
  status: number = 400
): Promise<void> {
  await page.route(
    url,
    async route => {
      await route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(errorResponse),
      });
    },
    { times: 1 }
  );
}

export async function cancelOperation(page: Page): Promise<void> {
  const cancelBtn: Locator = page.locator('button.btn.try-out__btn.cancel');
  await cancelBtn.click();
}

export async function getEndpointCopyButton(endpoint: Locator): Promise<Locator> {
  return endpoint.locator('.curl-command .copy-to-clipboard button');
}

export async function expectErrorOrFailureStatus(getEndpoint: Locator): Promise<void> {
  const errorElement: Locator = getEndpoint
    .locator('.response-col_description .renderedMarkdown p')
    .first();
  const statusElement: Locator = getEndpoint.locator('.response .response-col_status').first();

  await expect(errorElement).toBeVisible();
  await expect(statusElement).toBeVisible();

  const [errorText, statusText] = await Promise.all([
    errorElement.textContent(),
    statusElement.textContent(),
  ]);

  const cleanStatusText: string = (statusText || '').trim();
  const cleanErrorText: string = (errorText || '').trim();

  const hasErrorMessage: boolean = Object.values(errorMessages).some(msg =>
    cleanErrorText.includes(msg)
  );

  const hasFailureStatus: boolean =
    /^(0|4\d{2}|5\d{2})/.test(cleanStatusText) ||
    cleanStatusText === 'Undocumented' ||
    cleanStatusText === '';

  expect(hasFailureStatus).toBe(true);
  expect(hasErrorMessage).toBe(true);
}
export async function mockAuthorizeSuccess(
  page: Page,
  authorizeUrl: string,
  redirectUri: string,
  state?: string
): Promise<void> {
  await page.route(
    authorizeUrl,
    route => {
      const targetUrl: string = `${redirectUri}?code=abc123${state ? `&state=${state}` : ''}`;
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
        <html lang="en">
          <head>
            <meta http-equiv="refresh" content="0; url=${targetUrl}" />
          </head>
          <body>
            <p>Redirecting...</p>
          </body>
        </html>
      `,
      });
    },
    { times: 1 }
  );
}

export function buildSafeUrl(baseUrl: string, id: string): string {
  const trimmedBase: string = baseUrl.replace(/\/+$/, '');
  const encodedId: string = encodeURIComponent(id);
  return `${trimmedBase}/${encodedId}`;
}

export function parseJsonSafe<T>(text: string): T {
  try {
    return JSON.parse(text) as T;
  } catch (err) {
    throw new Error(
      `❌ Failed to parse JSON:\n${text}\n\nError: ${err instanceof Error ? err.message : err}`
    );
  }
}

export async function collapseEndpoint(endpoint: Locator): Promise<void> {
  const opblockSummary: Locator = endpoint.locator('.opblock-summary');
  const opblockBody: Locator = endpoint.locator('.opblock-body');

  await expect(opblockBody).toBeVisible();
  await expect(opblockSummary).toBeVisible();

  await opblockSummary.click();

  await expect(opblockBody).not.toBeVisible();
}
