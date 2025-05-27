import { test, expect, type Locator, type Page } from '@playwright/test';

const CRM_URL: string = 'https://api.vilnacrm.com';
const swaggerPath: string = '/swagger';

interface TopInfoLocators {
  backToMainLink: Locator;
  authorizeButton: Locator;
  title: Locator;
  description: Locator;
  version: Locator;
  versionStamp: Locator;
  serversTitle: Locator;
  serverSelect: Locator;
}

const getLocators: (page: Page) => TopInfoLocators = (page: Page) => ({
  backToMainLink: page.locator('div[role="navigation"]', { hasText: 'To the main page' }),
  authorizeButton: page.getByRole('button', { name: 'Authorize', exact: true }),
  title: page.getByRole('heading', { name: 'User Service API' }),
  description: page.getByText('This API provides endpoints'),
  version: page.locator('span > small:nth-of-type(1) > pre.version'),
  versionStamp: page.locator('.version-stamp'),
  serversTitle: page.locator('.servers-title'),
  serverSelect: page.locator('#servers'),
});

const verifyElementsPresence: (elements: TopInfoLocators) => Promise<void> = async (
  elements: TopInfoLocators
) => {
  await Promise.all(
    Object.values(elements).map(async element => {
      await expect(element).toBeVisible();
    })
  );
};

type VerifyElementPresence = (elements: {
  serversTitle: Locator;
  serverSelect: Locator;
}) => Promise<void>;
const verifyTextContent: VerifyElementPresence = async (elements: {
  serversTitle: Locator;
  serverSelect: Locator;
}): Promise<void> => {
  await expect(elements.serversTitle).toHaveText('Servers');
  await expect(elements.serverSelect).toHaveText(CRM_URL);
};

test.describe('Swagger UI Header', () => {
  test('should display all required elements and correct content', async ({ page }) => {
    await page.goto(swaggerPath);

    const elements: TopInfoLocators = getLocators(page);

    await verifyElementsPresence(elements);
    await verifyTextContent(elements);
  });

  test('select should work correctly', async ({ page }) => {
    await page.goto(swaggerPath);

    const serverSelect: Locator = page.locator('#servers');
    await serverSelect.click();

    const options: Locator = serverSelect.locator('option');

    await expect(options).toHaveCount(1);
  });

  test('authorize button open a modal window', async ({ page }) => {
    await page.goto(swaggerPath);

    const authorizeButton: Locator = page.locator('button.authorize');
    await authorizeButton.click();

    await expect(page.locator('.backdrop-ux')).toBeVisible();

    await expect(page.getByRole('heading', { name: 'Available authorizations' })).toBeVisible();

    const decSection: Locator = page.locator('.scope-def');
    await expect(decSection).toBeVisible();

    const paragraphs: Locator = decSection.locator('> p');
    await expect(paragraphs).toHaveCount(2);
  });
});
