import { expect, type Locator, Page, test } from '@playwright/test';

import { getResetPasswordEndpoints, GetResetPasswordEndpoints } from '../utils';
import {
  cancelOperation,
  clearEndpointResponse,
  collapseEndpoint,
  getAndCheckExecuteBtn,
  initSwaggerPage,
  interceptWithEmptyResponse,
} from '../utils/helpers';
import { locators } from '../utils/locators';

type ResetPasswordOperation = {
  title: string;
  pick: (endpoints: GetResetPasswordEndpoints) => Locator;
  route: string;
  path: string;
  jsonSample: string;
  ldJsonSample: string;
};

const OPERATIONS: ResetPasswordOperation[] = [
  {
    title: 'request password reset',
    pick: endpoints => endpoints.request,
    route: '**/api/reset-password',
    path: '/api/reset-password',
    jsonSample: 'password-reset@example.com',
    ldJsonSample: 'password-reset@example.com',
  },
  {
    title: 'confirm password reset',
    pick: endpoints => endpoints.confirm,
    route: '**/api/reset-password/confirm',
    path: '/api/reset-password/confirm',
    jsonSample: 'reset-confirm-token',
    ldJsonSample: 'reset-confirm-token-ld',
  },
];

const MEDIA_TYPES: string[] = ['application/json', 'application/ld+json'];

const containing = (text: string): RegExp =>
  new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

interface ResetPasswordElements {
  endpoint: Locator;
  executeBtn: Locator;
  contentTypeSelect: Locator;
  bodyEditor: Locator;
  curl: Locator;
  requestUrl: Locator;
  responseStatus: Locator;
}

async function setupEndpoint(
  page: Page,
  operation: ResetPasswordOperation
): Promise<ResetPasswordElements> {
  await initSwaggerPage(page);
  const endpoint: Locator = operation.pick(getResetPasswordEndpoints(page));

  await endpoint.click();
  await endpoint.getByRole('button', { name: 'Try it out' }).click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(endpoint);
  const requestBodySection: Locator = endpoint.locator(locators.requestBodySection);

  return {
    endpoint,
    executeBtn,
    contentTypeSelect: requestBodySection.locator(locators.contentTypeSelect),
    bodyEditor: requestBodySection.locator(locators.jsonEditor),
    curl: endpoint.locator(locators.curl),
    requestUrl: endpoint.locator(locators.requestUrl),
    responseStatus: endpoint.locator(locators.responseStatus).first(),
  };
}

for (const operation of OPERATIONS) {
  test.describe(`${operation.title} endpoint`, () => {
    test('executes the documented default body', async ({ page }) => {
      const elements: ResetPasswordElements = await setupEndpoint(page, operation);
      await interceptWithEmptyResponse(page, operation.route);

      await expect(elements.bodyEditor).toHaveValue(containing(operation.jsonSample));

      await elements.executeBtn.click();

      await expect(elements.responseStatus).toContainText('204');
      await expect(elements.requestUrl).toContainText(operation.path);
      await expect(elements.curl).toContainText(operation.jsonSample);

      await clearEndpointResponse(elements.endpoint);
    });

    test('refuses an empty request body', async ({ page }) => {
      const elements: ResetPasswordElements = await setupEndpoint(page, operation);

      await elements.bodyEditor.fill('');
      await elements.executeBtn.click();

      await expect(elements.bodyEditor).toHaveClass(/invalid/);

      await cancelOperation(page);
      await collapseEndpoint(elements.endpoint);
    });

    test('offers both documented request content types', async ({ page }) => {
      const elements: ResetPasswordElements = await setupEndpoint(page, operation);
      await interceptWithEmptyResponse(page, operation.route);

      await expect(elements.contentTypeSelect).toHaveValue('application/json');
      await expect(elements.contentTypeSelect.locator('option')).toHaveText(MEDIA_TYPES);

      await elements.contentTypeSelect.selectOption('application/ld+json');

      await expect(elements.bodyEditor).toHaveValue(containing(operation.ldJsonSample));

      await elements.executeBtn.click();

      await expect(elements.responseStatus).toContainText('204');
      await expect(elements.curl).toContainText('Content-Type: application/ld+json');

      await clearEndpointResponse(elements.endpoint);
    });
  });
}
