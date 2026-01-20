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

  // Wait for curl to be detached from DOM (not just hidden)
  await curl.waitFor({ state: 'detached' });
}

export async function initSwaggerPage(page: Page): Promise<SwaggerPageObjects> {
  await page.goto(TEST_CONSTANTS.SWAGGER_PATH, { waitUntil: 'domcontentloaded' });
  await page.locator('.swagger-ui').waitFor({ state: 'visible' });

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

  await expect(cancelBtn).toBeVisible();
  await expect(cancelBtn).toBeEnabled();

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
  const tryItOutButton: Locator = endpoint.locator('button:has-text("Try it out")');

  await expect(opblockSummary).toBeVisible();

  const isTryItOutVisible: boolean = await tryItOutButton.isVisible();
  if (!isTryItOutVisible) {
    await tryItOutButton.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
  }

  // Check if the endpoint is already collapsed
  const isAlreadyCollapsed: boolean = !(await opblockBody.isVisible());
  if (isAlreadyCollapsed) {
    return;
  }

  await expect(opblockBody).toBeVisible();

  // Wait for any ongoing animations/transitions to complete before clicking
  await opblockBody.evaluate(
    el =>
      new Promise<void>(resolve => {
        const animations: Animation[] = el.getAnimations();
        if (animations.length === 0) {
          resolve();
        } else {
          Promise.all(animations.map(a => a.finished)).then(() => resolve());
        }
      })
  );

  let collapsed: boolean = false;
  for (let attempt: number = 0; attempt < 3 && !collapsed; attempt += 1) {
    await opblockSummary.click();

    // Check if it actually collapsed
    try {
      await opblockBody.waitFor({ state: 'hidden', timeout: 3000 });
      collapsed = true;
    } catch {
      if (attempt < 2) {
        await opblockSummary.evaluate(
          () =>
            new Promise(resolve => {
              setTimeout(resolve, 500);
            })
        );
      }
    }
  }

  if (!collapsed) {
    await opblockBody.waitFor({ state: 'hidden' });
  }
}
