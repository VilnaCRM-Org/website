import { Page } from '@playwright/test';

import {
  getLocators,
  getUserEndpoints,
  GetUserEndpoints,
  SwaggerLocators,
  TEST_CONSTANTS,
} from './index';

interface SwaggerPageObjects {
  userEndpoints: GetUserEndpoints;
  elements: SwaggerLocators;
}

async function initSwaggerPage(page: Page): Promise<SwaggerPageObjects> {
  await page.goto(TEST_CONSTANTS.SWAGGER_PATH);

  const userEndpoints: GetUserEndpoints = getUserEndpoints(page);
  const elements: SwaggerLocators = getLocators(page);

  return { userEndpoints, elements };
}
export default initSwaggerPage;
