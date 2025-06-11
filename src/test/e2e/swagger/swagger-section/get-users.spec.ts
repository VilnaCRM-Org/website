import { expect, type Locator, Page, test } from '@playwright/test';

import { ApiUser, BasicEndpointElements } from '../utils/constants';
import {
  initSwaggerPage,
  clearEndpoint,
  getAndCheckExecuteBtn,
  interceptWithError,
} from '../utils/helpers';

interface EndpointElements extends BasicEndpointElements {
  pageNumberInput: Locator;
  itemsPerPageInput: Locator;
}

async function setupEndpoint(page: Page): Promise<EndpointElements> {
  const { userEndpoints, elements } = await initSwaggerPage(page);
  const getEndpoint: Locator = userEndpoints.getCollection;

  await getEndpoint.click();
  await elements.tryItOutButton.click();

  const executeBtn: Locator = await getAndCheckExecuteBtn(getEndpoint);
  const pageNumberInput: Locator = getEndpoint.locator(
    'tr[data-param-name="page"] input[placeholder="page"]'
  );
  const itemsPerPageInput: Locator = getEndpoint.locator(
    'tr[data-param-name="itemsPerPage"] input[placeholder="itemsPerPage"]'
  );
  const requestUrl: Locator = getEndpoint.locator('.request-url .microlight');
  const responseBody: Locator = getEndpoint
    .locator('.response-col_description .microlight')
    .first();

  return {
    getEndpoint,
    executeBtn,
    pageNumberInput,
    itemsPerPageInput,
    requestUrl,
    responseBody,
  };
}
async function executeAndVerifyParams(
  elements: EndpointElements,
  pageValue: string,
  itemsPerPageValue: string
): Promise<void> {
  await elements.executeBtn.click();
  await expect(elements.requestUrl).toContainText(`page=${pageValue}`);
  await expect(elements.requestUrl).toContainText(`itemsPerPage=${itemsPerPageValue}`);
}

async function verifyResponseBody(elements: EndpointElements): Promise<void> {
  const responseText: string = (await elements.responseBody?.textContent()) || '';
  const response: ApiUser[] = JSON.parse(responseText);

  expect(response).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        confirmed: expect.any(Boolean),
        email: expect.any(String),
        initials: expect.any(String),
        id: expect.any(String),
      }),
    ])
  );
}

async function checkErrorResponse(
  elements: EndpointElements,
  expectedStatus: string,
  expectedMessage: string
): Promise<void> {
  const responseBody: Locator = elements.getEndpoint
    .locator('.response-col_description .microlight')
    .first();
  const responseCode: Locator = elements.getEndpoint
    .locator('.response .response-col_status')
    .first();

  await expect(responseBody).toContainText(expectedMessage);
  await expect(responseCode).toContainText(expectedStatus);
}

test.describe('get user: try it out interaction', () => {
  test('default values', async ({ page }) => {
    const elements: EndpointElements = await setupEndpoint(page);
    const initialPageNumber: string = '1';
    const initialPerPageNumber: string = '30';

    await expect(elements.pageNumberInput).toHaveValue(initialPageNumber);
    await expect(elements.itemsPerPageInput).toHaveValue(initialPerPageNumber);

    await executeAndVerifyParams(elements, initialPageNumber, initialPerPageNumber);

    const curl: Locator = elements.getEndpoint.locator('.curl-command');
    await expect(curl).toBeVisible();

    const copyButton: Locator = elements.getEndpoint.locator(
      'div.curl-command .copy-to-clipboard button'
    );
    await expect(copyButton).toBeVisible();

    await verifyResponseBody(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('custom values', async ({ page }) => {
    const elements: EndpointElements = await setupEndpoint(page);
    const changedNumberPage: string = '2';
    const changedPerPageNumber: string = '15';

    await elements.pageNumberInput.fill(changedNumberPage);
    await elements.itemsPerPageInput.fill(changedPerPageNumber);

    await executeAndVerifyParams(elements, changedNumberPage, changedPerPageNumber);

    await verifyResponseBody(elements);

    await clearEndpoint(elements.getEndpoint);
  });

  test('empty values', async ({ page }) => {
    const elements: EndpointElements = await setupEndpoint(page);

    await elements.pageNumberInput.fill('');
    await elements.itemsPerPageInput.fill('');

    const pageCheckbox: Locator = elements.getEndpoint.locator(
      'tr[data-param-name="page"] input#include_empty_value'
    );
    const itemsPerPageCheckbox: Locator = elements.getEndpoint.locator(
      'tr[data-param-name="itemsPerPage"] input#include_empty_value'
    );

    await pageCheckbox.click();
    await itemsPerPageCheckbox.click();
    await elements.executeBtn.click();

    await expect(elements.requestUrl).toContainText(/page=(&|$)/);
    await expect(elements.requestUrl).toContainText(/itemsPerPage=(&|$)/);

    await verifyResponseBody(elements);

    await clearEndpoint(elements.getEndpoint);
  });
  test('error response handling', async ({ page }) => {
    const elements: EndpointElements = await setupEndpoint(page);

    await interceptWithError(page, 400, {
      error: 'Bad Request',
      message: 'Invalid pagination parameters',
      details: {
        page: 'Must be a positive number',
        itemsPerPage: 'Must be between 1 and 100',
      },
    });

    await elements.executeBtn.click();
    await checkErrorResponse(elements, '400', 'Invalid pagination parameters');
    await clearEndpoint(elements.getEndpoint);
  });
});
