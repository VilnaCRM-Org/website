import * as Sentry from '@sentry/react';

import { isProductionBuild } from '@/config/env';

const SERVICE_WORKER_URL = '/sw.js';

interface ServiceWorkerHost {
  navigator?: { serviceWorker?: ServiceWorkerContainer };
}

export function readServiceWorkerContainer(
  host: ServiceWorkerHost
): ServiceWorkerContainer | undefined {
  return host.navigator?.serviceWorker;
}

export function shouldRegisterServiceWorker(
  container: ServiceWorkerContainer | undefined,
  isProduction: boolean
): container is ServiceWorkerContainer {
  return container !== undefined && isProduction;
}

export function registerServiceWorker(container: ServiceWorkerContainer): void {
  container.register(SERVICE_WORKER_URL).catch((error: unknown) => {
    Sentry.captureException(error);
  });
}

export function whenLoaded(run: () => void): void {
  if (globalThis.document.readyState === 'complete') {
    run();
    return;
  }
  globalThis.addEventListener('load', run, { once: true });
}

export function initServiceWorker(): void {
  const container = readServiceWorkerContainer(globalThis as ServiceWorkerHost);
  if (!shouldRegisterServiceWorker(container, isProductionBuild())) {
    return;
  }
  whenLoaded(() => registerServiceWorker(container));
}
