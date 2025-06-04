import { faker } from '@faker-js/faker';
import { test, expect, type Locator, type Page } from '@playwright/test';

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

interface ServerElements {
  serversTitle: Locator;
  serverSelect: Locator;
}

interface AuthModalElements {
  modal: Locator;
  inputClientID: Locator;
  inputSecret: Locator;
  checkboxWrite: Locator;
  checkboxRead: Locator;
}
type TestConstants = {
  CRM_URL: string;
  SWAGGER_PATH: string;
  SELECTORS: {
    BACK_TO_MAIN: string;
    AUTHORIZE_BUTTON: string;
    AUTH_CONTAINER: string;
    CLIENT_ID_INPUT: string;
    CLIENT_SECRET_INPUT: string;
    WRITE_CHECKBOX: string;
    READ_CHECKBOX: string;
  };
};
const TEST_CONSTANTS: TestConstants = {
  CRM_URL: 'https://api.vilnacrm.com',
  SWAGGER_PATH: '/swagger',
  SELECTORS: {
    BACK_TO_MAIN: 'div[role="navigation"]',
    AUTHORIZE_BUTTON: 'button.authorize',
    AUTH_CONTAINER: '.auth-container',
    CLIENT_ID_INPUT: 'input[type="text"][data-name="clientId"]',
    CLIENT_SECRET_INPUT: 'input[type="password"][data-name="clientSecret"]',
    WRITE_CHECKBOX: 'label[for="write:pets-authorizationCode-checkbox-OAuth2"] span',
    READ_CHECKBOX: 'label[for="read:pets-authorizationCode-checkbox-OAuth2"] span',
  },
} as const;

const getLocators: (page: Page) => TopInfoLocators = (page: Page): TopInfoLocators => ({
  backToMainLink: page.locator(TEST_CONSTANTS.SELECTORS.BACK_TO_MAIN, {
    hasText: 'To the main page',
  }),
  authorizeButton: page.getByRole('button', { name: 'Authorize', exact: true }),
  title: page.getByRole('heading', { name: 'User Service API' }),
  description: page.getByText('This API provides endpoints'),
  version: page.locator('span > small:nth-of-type(1) > pre.version'),
  versionStamp: page.locator('.version-stamp'),
  serversTitle: page.locator('.servers-title'),
  serverSelect: page.locator('#servers'),
});

type Helpers = {
  verifyElementsPresence(elements: TopInfoLocators): Promise<void>;
  verifyTextContent(elements: ServerElements): Promise<void>;
  openAuthorizeModal(page: Page): Promise<AuthModalElements>;
};

const helpers: Helpers = {
  async verifyElementsPresence(elements: TopInfoLocators): Promise<void> {
    await Promise.all(
      Object.values(elements).map(async element => {
        await expect(element).toBeVisible();
      })
    );
  },

  async verifyTextContent(elements: ServerElements): Promise<void> {
    await expect(elements.serversTitle).toHaveText('Servers');
    await expect(elements.serverSelect).toHaveText(TEST_CONSTANTS.CRM_URL);
  },

  async openAuthorizeModal(page: Page): Promise<AuthModalElements> {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    await page.locator(TEST_CONSTANTS.SELECTORS.AUTHORIZE_BUTTON).click();

    const modal: Locator = page.locator(TEST_CONSTANTS.SELECTORS.AUTH_CONTAINER);
    return {
      modal,
      inputClientID: modal.locator(TEST_CONSTANTS.SELECTORS.CLIENT_ID_INPUT),
      inputSecret: modal.locator(TEST_CONSTANTS.SELECTORS.CLIENT_SECRET_INPUT),
      checkboxWrite: modal.locator(TEST_CONSTANTS.SELECTORS.WRITE_CHECKBOX),
      checkboxRead: modal.locator(TEST_CONSTANTS.SELECTORS.READ_CHECKBOX),
    };
  },
};

test.describe('Swagger UI Header', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
  });

  test.describe('Basic Elements', () => {
    test('should display all required elements and correct content', async ({ page }) => {
      const elements: TopInfoLocators = getLocators(page);
      await helpers.verifyElementsPresence(elements);
      await helpers.verifyTextContent(elements);
    });

    test('server select should work correctly', async ({ page }) => {
      const serverSelect: Locator = page.locator('#servers');
      await expect(serverSelect).toBeVisible();

      await serverSelect.click();
      await expect(serverSelect.locator('option')).toHaveCount(1);
    });
  });

  test.describe('Authorization Modal', () => {
    test('opens and displays correctly', async ({ page }) => {
      const { modal } = await helpers.openAuthorizeModal(page);
      await expect(modal).toBeVisible();
      await expect(page.locator('.backdrop-ux')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Available authorizations' })).toBeVisible();

      const decSection: Locator = page.locator('.scope-def');
      await expect(decSection).toBeVisible();
      await expect(decSection.locator('> p')).toHaveCount(2);
    });

    test('handles input fields correctly', async ({ page }) => {
      const { inputClientID, inputSecret } = await helpers.openAuthorizeModal(page);
      const fakeClientID: string = faker.string.alphanumeric(12);
      const fakeSecret: string = faker.string.alphanumeric(12);

      await expect(inputClientID).toBeVisible();
      await expect(inputSecret).toBeVisible();

      await inputClientID.fill(fakeClientID);
      await inputSecret.fill(fakeSecret);

      await expect(inputClientID).toHaveValue(fakeClientID);
      await expect(inputSecret).toHaveValue(fakeSecret);
    });

    test('manages scopes correctly', async ({ page }) => {
      const { modal, checkboxWrite, checkboxRead } = await helpers.openAuthorizeModal(page);
      const scopesHeading: Locator = modal.locator('h2', { hasText: 'Scopes' });
      const [selectAll, selectNone] = await scopesHeading.locator('a').all();

      await expect(selectAll).toHaveText('select all');
      await expect(selectNone).toHaveText('select none');

      // Test checkboxes
      await checkboxWrite.click();
      await checkboxRead.click();
      await expect(checkboxWrite).toBeChecked();
      await expect(checkboxRead).toBeChecked();

      await selectNone.click();
      await expect(checkboxWrite).not.toBeChecked();
      await expect(checkboxRead).not.toBeChecked();

      await selectAll.click();
      await expect(checkboxWrite).toBeChecked();
      await expect(checkboxRead).toBeChecked();

      const closeButton: Locator = modal.locator('button:has-text("Close")');
      await closeButton.click();
      await expect(modal).not.toBeVisible();
    });

    test('authorize button opens oauth dialog', async ({ page }) => {
      const { modal } = await helpers.openAuthorizeModal(page);
      const authorizeButton: Locator = modal.locator('button:has-text("Authorize")');

      const [newTab] = await Promise.all([page.waitForEvent('popup'), authorizeButton.click()]);

      await expect(newTab).toHaveURL(/\/api\/oauth\/dialog/);
    });
  });
});
