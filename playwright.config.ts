import { defineConfig, devices } from '@playwright/test';
import dotenv, { DotenvConfigOutput } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const env: DotenvConfigOutput = dotenv.config();

dotenvExpand.expand(env);

const BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://prod:3001';

export default defineConfig({
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retry twice in CI so a transient cross-container/network blip self-heals
  // instead of failing the run; this also activates `trace: 'on-first-retry'`
  // below (dead config while retries were 0). Locally retries stay at 0.
  retries: process.env.CI ? 2 : 0,
  // Omit `workers` off-CI (Playwright's own default) rather than passing an
  // explicit `undefined`, which `exactOptionalPropertyTypes` rejects.
  ...(process.env.CI ? { workers: 1 } : {}),
  // The HTML report is for humans; the JSON one is what the flake gate (#359) reads. Without
  // it a retry-pass (`status: 'flaky'`) is indistinguishable from a clean pass, which is how
  // the WebKit swagger flake in #290 reached the production pipeline. The path is
  // overridable so the burn-in leg can keep its report separate from the shard run's.
  reporter: [
    ['html', { open: 'never' }],
    ['json', { outputFile: process.env.PLAYWRIGHT_JSON_REPORT ?? 'test-results/results.json' }],
  ],
  use: {
    trace: 'on-first-retry',
    ignoreHTTPSErrors: true,
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      [`aws-cf-cd-${process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME}`]:
        process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE!,
    },
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Required for cross-container communication in Docker test environment (for CORS)
        launchOptions: {
          args: [
            '--disable-web-security',
            '--disable-features=IsolateOrigins',
            '--disable-site-isolation-trials',
          ],
        },
      },
    },

    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
