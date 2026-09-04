import * as Sentry from '@sentry/react';

import { isProductionBuild } from '@/config/env';

/**
 * Service-worker registration for the offline shell (issue #338).
 *
 * The worker itself lives in `public/sw.js` and is a fallback-only shell — see its header
 * for why it never caches at runtime. This module is the browser-side half: it decides
 * whether registering is safe, and when.
 *
 * Mirrors `src/lib/web-vitals/report-web-vitals.ts`: ambient globals are read off
 * `globalThis` through a cast rather than referenced bare, the decision is a pure
 * argument-injected predicate, and the orchestrator wired into `pages/_app.tsx` stays thin.
 */

// Served from `public/`, so the worker's scope is the whole origin — every route gets the
// offline shell without a `Service-Worker-Allowed` header the static export cannot set.
const SERVICE_WORKER_URL = '/sw.js';

/**
 * How this module models `navigator`. It is absent in the Node Jest layers, and the DOM lib
 * types `navigator.serviceWorker` as always present even though it is missing on insecure
 * origins, in jsdom, and in some privacy modes — so both are widened to optional here and
 * the absence is handled as data rather than as an environment check.
 */
interface ServiceWorkerHost {
  navigator?: { serviceWorker?: ServiceWorkerContainer };
}

export function readServiceWorkerContainer(
  host: ServiceWorkerHost
): ServiceWorkerContainer | undefined {
  return host.navigator?.serviceWorker;
}

/**
 * Pure gate. Registration is production-only: a worker installed by `next dev` would serve
 * its shell across HMR reloads and mask a genuinely broken dev build. Taking both inputs as
 * arguments keeps the decision deterministic, and the type predicate lets the caller use the
 * narrowed container without a redundant re-check.
 */
export function shouldRegisterServiceWorker(
  container: ServiceWorkerContainer | undefined,
  isProduction: boolean
): container is ServiceWorkerContainer {
  return container !== undefined && isProduction;
}

/**
 * A rejected `register()` (unsupported scope, blocked storage, a 404 on the script after a
 * partial deploy) must stay silent for the visitor — the site works fine without a worker —
 * but must not vanish, so it goes to Sentry rather than a console nobody reads.
 */
export function registerServiceWorker(container: ServiceWorkerContainer): void {
  container.register(SERVICE_WORKER_URL).catch((error: unknown) => {
    Sentry.captureException(error);
  });
}

/**
 * Defer work until the page has finished loading, so registration never competes with
 * hydration or the LCP paint. `_app`'s effect can run either side of `load` depending on how
 * long the subresources take, so an already-complete document runs the callback immediately
 * rather than waiting for an event that will never fire again. `once` lets the browser drop
 * the listener after it fires instead of holding the closure for the page's lifetime.
 */
export function whenLoaded(run: () => void): void {
  if (globalThis.document.readyState === 'complete') {
    run();
    return;
  }
  globalThis.addEventListener('load', run, { once: true });
}

/**
 * Orchestrator wired into `pages/_app.tsx`.
 */
export function initServiceWorker(): void {
  const container = readServiceWorkerContainer(globalThis as ServiceWorkerHost);
  if (!shouldRegisterServiceWorker(container, isProductionBuild())) {
    return;
  }
  whenLoaded(() => registerServiceWorker(container));
}
