import { test, expect, Page } from '@playwright/test';

import { t } from './utils/initializeLocalization';

/**
 * Browser-level guarantees for the offline shell worker (`public/sw.js`).
 *
 * What this file exists for, in order of importance:
 *   1. the worker registers and takes control on a real page, so the offline shell is not
 *      dead code;
 *   2. a `page.route` mock still wins while the worker controls the page — this is the
 *      regression guard for the whole e2e estate, which mocks the API in 15+ places;
 *   3. the fallback document is genuinely in the cache, so the handler has something to
 *      serve when a navigation fails.
 *
 * The fetch handler's own branches (network-first, the fallback on rejection, ignoring
 * non-navigations and cross-origin navigations) are covered exhaustively and at 100% by
 * `src/test/edge/service-worker.test.ts`, which drives the shipped file directly. They are
 * deliberately NOT re-asserted through a browser here: Playwright's offline emulation
 * (`context.setOffline`) and its request routing both intercept a navigation *above* the
 * service worker, so the navigation fails with `ERR_FAILED` before the worker is ever
 * consulted — measured, not assumed. Asserting through them would test Playwright's
 * interception order, not this worker.
 */

const offlineHeading: string = t('offline.heading');

// Service workers are only exposed on a trustworthy origin. In the Docker test stack the
// site is served at `http://prod:3001`, which is neither HTTPS nor localhost, so Chromium
// withholds `navigator.serviceWorker` entirely. Mapping `localhost` onto that host gives a
// trustworthy origin for the same server: the hostname is what makes an origin trustworthy,
// and production is served over HTTPS by CloudFront, so this restores the real condition
// rather than relaxing one. Under HOST_STACK=1 the site is already on localhost and no
// mapping is needed.
const { protocol, hostname, port } = new URL(
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://prod:3001'
);
const isAlreadyTrustworthy: boolean = hostname === 'localhost' || hostname === '127.0.0.1';
const trustworthyBaseUrl: string = `${protocol}//localhost:${port}`;

const OFFLINE_URL: string = '/offline.html';
const MOCKED_PROBE: string = '/service-worker-probe.json';

test.use({
  baseURL: trustworthyBaseUrl,
  launchOptions: {
    args: [
      // Same cross-container CORS flags the chromium project carries.
      '--disable-web-security',
      '--disable-features=IsolateOrigins',
      '--disable-site-isolation-trials',
      ...(isAlreadyTrustworthy ? [] : [`--host-resolver-rules=MAP localhost ${hostname}`]),
    ],
  },
});

// The worker lifecycle is engine-specific in its timing, and this file asserts on the exact
// moment control is taken. Running it on all three desktop engines would add flake to the
// sharded matrix without testing anything the worker does differently.
test.skip(
  ({ browserName }) => browserName !== 'chromium',
  'Service-worker lifecycle timing is engine-specific; chromium is the reference engine.'
);

async function activateServiceWorker(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  // The first load installs the worker; it only controls the page from the next navigation.
  await page.reload();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test.describe('Offline shell service worker', () => {
  test('takes control of the page after a reload', async ({ page }) => {
    await activateServiceWorker(page);

    const controllerScript: string | null = await page.evaluate(
      () => navigator.serviceWorker.controller?.scriptURL ?? null
    );

    expect(controllerScript).toContain('/sw.js');
  });

  test('leaves a page.route-mocked request to the mock', async ({ page }) => {
    await activateServiceWorker(page);
    await page.route(`**${MOCKED_PROBE}`, route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ servedBy: 'page.route' }),
      })
    );

    const payload: unknown = await page.evaluate(async (url: string) => {
      const response: Response = await fetch(url);
      return response.json();
    }, MOCKED_PROBE);

    // The worker returns before `respondWith` for anything that is not a same-origin
    // navigation, so the request stays visible to Playwright's interception.
    expect(payload).toEqual({ servedBy: 'page.route' });
  });

  test('precaches the offline fallback document and nothing else', async ({ page }) => {
    await activateServiceWorker(page);

    const precache: { keys: string[]; urls: string[]; status: number | null; body: string } =
      await page.evaluate(async (offlineUrl: string) => {
        const keys: string[] = await caches.keys();
        const cache: Cache = await caches.open(keys[0] as string);
        const requests: readonly Request[] = await cache.keys();
        const hit: Response | undefined = await caches.match(offlineUrl);

        return {
          keys,
          urls: requests.map(request => new URL(request.url).pathname),
          status: hit?.status ?? null,
          body: hit ? await hit.text() : '',
        };
      }, OFFLINE_URL);

    // Exactly one entry: precaching a hashed `_next/static` chunk would pin a build that the
    // next deploy replaces, and it would then be served forever.
    expect(precache.keys).toHaveLength(1);
    expect(precache.urls).toEqual([OFFLINE_URL]);
    expect(precache.status).toBe(200);
    // The cached bytes are the real translated document, not an empty or error response.
    expect(precache.body).toContain(offlineHeading);
  });
});
