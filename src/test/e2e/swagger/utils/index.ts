import type { Locator, Page } from '@playwright/test';

export type UserEndpoints = {
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

export const USER_ENDPOINTS: UserEndpoints = {
  GET_COLLECTION: '#operations-User-api_users_get_collection',
  CREATE: '#operations-User-create_http',
  CREATE_BATCH: '#operations-User-create_batch_http',
  CONFIRM: '#operations-User-confirm_http',
  GET_BY_ID: '#operations-User-api_users_id_get',
  UPDATE_BY_ID: '#operations-User-api_users_id_put',
  DELETE_BY_ID: '#operations-User-api_users_id_delete',
  PATCH_BY_ID: '#operations-User-api_users_id_patch',
  RESEND_CONFIRMATION: '#operations-User-api_users_idresend-confirmation-email_post',
} as const;

type SystemEndpoints = {
  HEALTH: string;
  AUTHORIZE: string;
  TOKEN: string;
};
export const SYSTEM_ENDPOINTS: SystemEndpoints = {
  HEALTH: '#operations-HealthCheck-api_health_get',
  AUTHORIZE: '#operations-OAuth-get_api_oauth_authorize',
  TOKEN: '#operations-OAuth-post_api_oauth_token',
} as const;

export interface GetSystemEndpoints {
  healthCheck: Locator;
  authorize: Locator;
  token: Locator;
}

export const getSystemEndpoints: (page: Page) => GetSystemEndpoints = (
  page: Page
): GetSystemEndpoints => ({
  healthCheck: page.locator(SYSTEM_ENDPOINTS.HEALTH),
  authorize: page.locator(SYSTEM_ENDPOINTS.AUTHORIZE),
  token: page.locator(SYSTEM_ENDPOINTS.TOKEN),
});

export type SwaggerLocators = {
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
};

export interface GetUserEndpoints {
  getCollection: Locator;
  create: Locator;
  createBatch: Locator;
  confirm: Locator;
  getById: Locator;
  updateById: Locator;
  deleteById: Locator;
  patchById: Locator;
  resendConfirmation: Locator;
}
export const getUserEndpoints: (page: Page) => GetUserEndpoints = (
  page: Page
): GetUserEndpoints => ({
  getCollection: page.locator(USER_ENDPOINTS.GET_COLLECTION),
  create: page.locator(USER_ENDPOINTS.CREATE),
  createBatch: page.locator(USER_ENDPOINTS.CREATE_BATCH),
  confirm: page.locator(USER_ENDPOINTS.CONFIRM),
  getById: page.locator(USER_ENDPOINTS.GET_BY_ID),
  updateById: page.locator(USER_ENDPOINTS.UPDATE_BY_ID),
  deleteById: page.locator(USER_ENDPOINTS.DELETE_BY_ID),
  patchById: page.locator(USER_ENDPOINTS.PATCH_BY_ID),
  resendConfirmation: page.locator(USER_ENDPOINTS.RESEND_CONFIRMATION),
});

export type Selectors = {
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
};
export const SELECTORS: Selectors = {
  API_DOCUMENTATION: '.swagger-ui',
  NAVIGATION: 'div[role="navigation"]',
  AUTHORIZE_BUTTON: 'button.authorize',
  ENDPOINTS: '.opblock',
  SCHEME_CONTAINER: '.scheme-container',
  ENDPOINT_BODY: '.opblock-body',
  TRY_IT_OUT_BUTTON: '[data-testid="try-it-out-button"], .try-out__btn',
  EXECUTE_BUTTON: '[data-testid="execute-button"], .execute',
  RESPONSE_SECTION: '.responses-wrapper',
  REQUEST_BODY: '.opblock-section-request-body',
} as const;

export type TestConstants = {
  SWAGGER_PATH: string;
  SELECTORS: Selectors;
  API_RESPONSE_TIMEOUT: number;
};

export const TEST_CONSTANTS: TestConstants = {
  SWAGGER_PATH: '/swagger',
  SELECTORS,
  API_RESPONSE_TIMEOUT: 2000,
};
export const getLocators: (page: Page) => SwaggerLocators = (page: Page): SwaggerLocators => ({
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
});

export interface SwaggerPageObjects {
  userEndpoints: GetUserEndpoints;
  elements: SwaggerLocators;
}
