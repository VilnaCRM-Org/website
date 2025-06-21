import { defineConfig, devices } from '@playwright/test';
import dotenv, { DotenvConfigOutput } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const env: DotenvConfigOutput = dotenv.config();
dotenvExpand.expand(env);
interface CommonSettings {
  ignoreHTTPSErrors: boolean;
  baseURL: string;
  trace: 'on-first-retry';
  extraHTTPHeaders: { [key: string]: string };
}
const baseURL: string =
 process.env.NEXT_PUBLIC_PROD_CONTAINER_API_URL ||
  process.env.NEXT_PUBLIC_WEBSITE_URL ||
  'http://127.0.0.1:3001';

const commonSettings:CommonSettings = {
  ignoreHTTPSErrors: true,
  baseURL,
  trace: 'on-first-retry' as const,
  extraHTTPHeaders: process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME
    ? {
         [`aws-cf-cd-${process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME}`]:
          process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE || '',
      }
    : {},
};

export default defineConfig({
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...commonSettings,
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...commonSettings,
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        ...commonSettings,
      },
    },
  ],
});
