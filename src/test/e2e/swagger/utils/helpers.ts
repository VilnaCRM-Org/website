import { expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { executeBtnSelector } from './constants';
import {
  CORS_HEADERS,
  createNetworkFailureRouteHandler,
  fulfillPreflight,
  isExpectedFailureState,
} from './networkFailure';

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
      if (await fulfillPreflight(route)) {
        return;
      }

      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(errorResponse),
      });
    }
  );
}

export async function interceptWithJsonResponse(
  page: Page,
  url: string | RegExp,
  responseBody: unknown,
  status: number = 200
): Promise<void> {
  await page.route(
    url,
    async route => {
      if (await fulfillPreflight(route)) {
        return;
      }

      await route.fulfill({
        status,
        contentType: 'application/json',
        headers: CORS_HEADERS,
        body: JSON.stringify(responseBody),
      });
    }
  );
}

export async function interceptWithEmptyResponse(
  page: Page,
  url: string | RegExp,
  status: number = 204
): Promise<void> {
  await page.route(
    url,
    async route => {
      if (await fulfillPreflight(route)) {
        return;
      }

      await route.fulfill({
        status,
        headers: CORS_HEADERS,
        body: '',
      });
    }
  );
}

export async function interceptWithNetworkFailure(
  page: Page,
  url: string | RegExp,
  options?: {
    times?: number;
  }
): Promise<void> {
  await page.route(url, createNetworkFailureRouteHandler(options));
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

async function readFailureState(getEndpoint: Locator): Promise<{
  combinedErrorText: string;
  statusText: string | null;
}> {
  const responseDescription: Locator = getEndpoint.locator('.response-col_description').first();
  const responseBody: Locator = getEndpoint.locator('.response .highlight-code').first();
  const statusLocator: Locator = getEndpoint.locator('.response .response-col_status').first();

  const descriptionText: string | null = await responseDescription.textContent().catch(() => null);
  const responseBodyText: string | null = await responseBody.textContent().catch(() => null);
  const statusText: string | null = await statusLocator.textContent().catch(() => null);
  const combinedErrorText: string = [descriptionText, responseBodyText]
    .filter((value): value is string => Boolean(value))
    .join('\n')
    .trim();

  return {
    combinedErrorText,
    statusText,
  };
}

export async function expectErrorOrFailureStatus(getEndpoint: Locator): Promise<void> {
  const responseSection: Locator = getEndpoint.locator('.responses-wrapper, .responses-inner').first();

  await expect(responseSection).toBeVisible();
  await expect
    .poll(
      async (): Promise<boolean> => {
        const { combinedErrorText, statusText } = await readFailureState(getEndpoint);

        return isExpectedFailureState(combinedErrorText, statusText);
      },
      {
        timeout: 10000,
      }
    )
    .toBe(true);
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
