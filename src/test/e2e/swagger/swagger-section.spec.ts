import { test, expect, type Page, type Locator } from '@playwright/test';

type SwaggerLocators = {
  apiDocumentation: Locator;
  navigation: Locator;
  authorizeButton: Locator;
  endpoints: Locator;
  schemeContainer: Locator;
  endpointBody: Locator;
  tryItOutButton: Locator;
  executeButton: Locator;
  responseSection: Locator;
  requestBody: Locator;
  userEndpoints: {
    getCollection: Locator;
    create: Locator;
    createBatch: Locator;
    confirm: Locator;
    getById: Locator;
    updateById: Locator;
    deleteById: Locator;
    patchById: Locator;
    resendConfirmation: Locator;
  };
};

type TestConstants = {
  SWAGGER_PATH: string;
  SELECTORS: {
    API_DOCUMENTATION: string;
    NAVIGATION: string;
    AUTHORIZE_BUTTON: string;
    ENDPOINTS: string;
    SCHEME_CONTAINER: string;
    ENDPOINT_BODY: string;
    TRY_IT_OUT_BUTTON: string;
    EXECUTE_BUTTON: string;
    RESPONSE_SECTION: string;
    REQUEST_BODY: string;
    USER_ENDPOINTS: {
      GET_COLLECTION: string;
      CREATE: string;
      CREATE_BATCH: string;
      CONFIRM: string;
      GET_BY_ID: string;
      UPDATE_BY_ID: string;
      DELETE_BY_ID: string;
      PATCH_BY_ID: string;
      RESEND_CONFIRMATION: string;
    };
  };
};

const TEST_CONSTANTS: TestConstants = {
  SWAGGER_PATH: '/swagger',
  SELECTORS: {
    API_DOCUMENTATION: '.swagger-ui',
    NAVIGATION: 'div[role="navigation"]',
    AUTHORIZE_BUTTON: 'button.authorize',
    ENDPOINTS: '.opblock',
    SCHEME_CONTAINER: '.scheme-container',
    ENDPOINT_BODY: '.opblock-body',
    TRY_IT_OUT_BUTTON: '.try-out__btn',
    EXECUTE_BUTTON: '.execute',
    RESPONSE_SECTION: '.responses-wrapper',
    REQUEST_BODY: '.opblock-section-request-body',
    USER_ENDPOINTS: {
      GET_COLLECTION: '#operations-User-api_users_get_collection',
      CREATE: '#operations-User-create_http',
      CREATE_BATCH: '#operations-User-create_batch_http',
      CONFIRM: '#operations-User-confirm_http',
      GET_BY_ID: '#operations-User-api_users_id_get',
      UPDATE_BY_ID: '#operations-User-api_users_id_put',
      DELETE_BY_ID: '#operations-User-api_users_id_delete',
      PATCH_BY_ID: '#operations-User-api_users_id_patch',
      RESEND_CONFIRMATION: '#operations-User-api_users_idresend-confirmation-email_post',
    },
  },
} as const;

const getLocators: (page: Page) => SwaggerLocators = (page: Page): SwaggerLocators => ({
  apiDocumentation: page.locator(TEST_CONSTANTS.SELECTORS.API_DOCUMENTATION),
  navigation: page.locator(TEST_CONSTANTS.SELECTORS.NAVIGATION),
  authorizeButton: page.locator(TEST_CONSTANTS.SELECTORS.AUTHORIZE_BUTTON),
  endpoints: page.locator(TEST_CONSTANTS.SELECTORS.ENDPOINTS),
  schemeContainer: page.locator(TEST_CONSTANTS.SELECTORS.SCHEME_CONTAINER),
  endpointBody: page.locator(TEST_CONSTANTS.SELECTORS.ENDPOINT_BODY),
  tryItOutButton: page.locator(TEST_CONSTANTS.SELECTORS.TRY_IT_OUT_BUTTON),
  executeButton: page.locator(TEST_CONSTANTS.SELECTORS.EXECUTE_BUTTON),
  responseSection: page.locator(TEST_CONSTANTS.SELECTORS.RESPONSE_SECTION),
  requestBody: page.locator(TEST_CONSTANTS.SELECTORS.REQUEST_BODY),
  userEndpoints: {
    getCollection: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.GET_COLLECTION),
    create: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.CREATE),
    createBatch: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.CREATE_BATCH),
    confirm: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.CONFIRM),
    getById: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.GET_BY_ID),
    updateById: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.UPDATE_BY_ID),
    deleteById: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.DELETE_BY_ID),
    patchById: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.PATCH_BY_ID),
    resendConfirmation: page.locator(TEST_CONSTANTS.SELECTORS.USER_ENDPOINTS.RESEND_CONFIRMATION),
  },
});

test.describe('Swagger Section', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    elements = getLocators(page);
  });

  test('should display main Swagger UI components', async () => {
    await expect(elements.apiDocumentation).toBeVisible();
    await expect(elements.navigation).toBeVisible();
    await expect(elements.authorizeButton).toBeVisible();
    await expect(elements.schemeContainer).toBeVisible();
  });

  test('should display API endpoints', async () => {
    await elements.endpoints.first().waitFor({ state: 'visible' });
    const endpointsCount: number = await elements.endpoints.count();

    for (let i: number = 0; i < endpointsCount; i += 1) {
      await expect(elements.endpoints.nth(i)).toBeVisible();
    }

    expect(endpointsCount).toBeGreaterThan(0);
    await expect(elements.endpoints).toHaveCount(12);
  });

  test('should expand endpoint details when clicked', async () => {
    const firstEndpoint: Locator = elements.endpoints.first();
    await firstEndpoint.click();

    const endpointContent: Locator = firstEndpoint.locator('.opblock-body');
    await expect(endpointContent).toBeVisible();
  });
});

test.describe('User Section', () => {
  let elements: SwaggerLocators;

  test.beforeEach(async ({ page }) => {
    await page.goto(TEST_CONSTANTS.SWAGGER_PATH);
    elements = getLocators(page);
  });

  test('should display all User endpoints', async () => {
    const endpoints: (keyof SwaggerLocators['userEndpoints'])[] = [
      'getCollection',
      'create',
      'createBatch',
      'confirm',
      'getById',
      'updateById',
      'deleteById',
      'patchById',
      'resendConfirmation',
    ];

    for (const endpoint of endpoints) {
      await expect(elements.userEndpoints[endpoint]).toBeVisible();
    }
  });

  // don't work yet. different blocks has different components
  test('should expand create user endpoint details', async () => {
    await elements.userEndpoints.create.click();
    await expect(elements.endpointBody).toBeVisible();

    // Check if the request body section is visible
    await expect(elements.requestBody).toBeVisible();

    // Verify required fields are present
    const requestBodySchema: Locator = elements.requestBody.locator('.model-box');
    await expect(requestBodySchema).toBeVisible();
    await expect(requestBodySchema.getByText('email')).toBeVisible();
    await expect(requestBodySchema.getByText('password')).toBeVisible();
    await expect(requestBodySchema.getByText('initials')).toBeVisible();
  });

  test('should expand get user by id endpoint details', async () => {
    await elements.userEndpoints.getById.click();
    await expect(elements.endpointBody).toBeVisible();

    const parametersSection: Locator = elements.endpointBody.locator('.parameters-container');
    await expect(parametersSection).toBeVisible();

    // Verify required parameter is present
    await expect(parametersSection.getByText('id')).toBeVisible();
  });

  // work
  test('should show Try it out functionality for create user', async () => {
    await elements.userEndpoints.create.click();
    await elements.tryItOutButton.click();

    // Verify execute button is visible after clicking Try it out
    await expect(elements.executeButton).toBeVisible();

    // Verify request body becomes editable
    const requestBodyEditor: Locator = elements.requestBody.locator('.body-param__text');
    await expect(requestBodyEditor).toBeEditable();
  });
  //  doesn't work
  test('should show response section after execution', async () => {
    await elements.userEndpoints.create.click();
    await elements.tryItOutButton.click();
    await elements.executeButton.click();

    // Verify response section becomes visible
    await expect(elements.responseSection).toBeVisible();

    // Verify response contains expected sections
    const responseBody: Locator = elements.responseSection.locator('.responses-table');
    await expect(responseBody).toBeVisible();
    await expect(responseBody.getByText('Response body')).toBeVisible();
    await expect(responseBody.getByText('Response headers')).toBeVisible();
  });

  // work
  test('should have navigation working', async ({ page }) => {
    await elements.navigation.click();
    await expect(page).toHaveURL('/');
  });
});
