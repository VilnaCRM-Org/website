import { defineConfig, devices } from '@playwright/test';
import dotenv, { DotenvConfigOutput } from 'dotenv';
import dotenvExpand from 'dotenv-expand';

const env: DotenvConfigOutput = dotenv.config();

dotenvExpand.expand(env);

const BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://prod:3001';

// Required for cross-container communication in Docker test environment (for CORS).
// Shared by both Chromium-based projects so the two can never drift apart and
// leave one of them failing every cross-origin request.
const CHROMIUM_CROSS_CONTAINER_ARGS: string[] = [
  '--disable-web-security',
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
];

// The touch specs get their own directory, and the split is declared once here so
// `testDir` and `testIgnore` cannot drift: Playwright interpolates the project
// name into the `toHaveScreenshot()` path template, so a mobile project that also
// collected the desktop specs would demand a second, mobile-named set of visual
// baselines for screenshots that already have one.
const MOBILE_TEST_DIR: string = './src/test/e2e/mobile';
const MOBILE_TEST_IGNORE: string = '**/src/test/e2e/mobile/**';

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
      testIgnore: MOBILE_TEST_IGNORE,
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: { args: CHROMIUM_CROSS_CONTAINER_ARGS },
      },
    },

    {
      name: 'firefox',
      testIgnore: MOBILE_TEST_IGNORE,
      use: { ...devices['Desktop Firefox'] },
    },

    {
      name: 'webkit',
      testIgnore: MOBILE_TEST_IGNORE,
      use: { ...devices['Desktop Safari'] },
    },

    {
      name: 'mobile-chrome',
      // Scoped by `testDir`, not just by a name: re-running the desktop specs at
      // 412px buys no signal. The header nav list and the auth buttons are
      // `display: none` below `lg` by design, so those specs cannot pass here,
      // and the ones that would pass would be asserting the mobile layout under a
      // "Desktop ..." name. Only specs that genuinely need a touch device belong.
      testDir: MOBILE_TEST_DIR,
      use: {
        // Pixel 7 is what makes this project different in kind rather than in
        // width: it sets `isMobile` (the only mode that honours the exported
        // `<meta name="viewport">`) and `hasTouch` (`locator.tap()` throws
        // without it). Playwright rejects `isMobile` on Firefox, so a touch
        // project has to be Chromium-based.
        ...devices['Pixel 7'],
        launchOptions: { args: CHROMIUM_CROSS_CONTAINER_ARGS },
      },
    },
  ],
});
