/**
 * Integration: service-worker registration
 * (`src/lib/pwa/register-service-worker.ts`).
 *
 * Drives the pure container read, the production gate, the failure report and the
 * load-deferred orchestrator wired into `pages/_app.tsx`. Sentry is stubbed so the failure
 * path can be asserted without a live client, and the browser globals the module reads
 * (`navigator.serviceWorker`, `document.readyState`) are installed per test — jsdom ships
 * neither a service-worker container nor a document that is still loading.
 */
import * as Sentry from '@sentry/react';

import {
  initServiceWorker,
  readServiceWorkerContainer,
  registerServiceWorker,
  shouldRegisterServiceWorker,
  whenLoaded,
} from '@/lib/pwa/register-service-worker';

jest.mock('@sentry/react', () => ({ captureException: jest.fn() }));

type CaptureException = typeof Sentry.captureException;
const mockedCaptureException = Sentry.captureException as jest.MockedFunction<CaptureException>;

interface ContainerStub {
  register: jest.Mock;
}

function makeContainer(): ContainerStub {
  return { register: jest.fn().mockResolvedValue({}) };
}

function asContainer(stub: ContainerStub): ServiceWorkerContainer {
  return stub as unknown as ServiceWorkerContainer;
}

/** Installs a service-worker container on jsdom's navigator, which ships without one. */
function stubNavigatorContainer(stub: ContainerStub): void {
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: asContainer(stub),
    configurable: true,
  });
}

function clearNavigatorContainer(): void {
  Reflect.deleteProperty(globalThis.navigator, 'serviceWorker');
}

function stubReadyState(readyState: DocumentReadyState): void {
  Object.defineProperty(globalThis.document, 'readyState', {
    value: readyState,
    configurable: true,
  });
}

function clearReadyState(): void {
  Reflect.deleteProperty(globalThis.document, 'readyState');
}

/** Runs `body` with the build mode Next.js would inline into a production export. */
function withProductionBuild(body: () => void): void {
  const original: string | undefined = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
  try {
    body();
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
  }
}

afterEach(() => {
  clearNavigatorContainer();
  clearReadyState();
});

describe('readServiceWorkerContainer', () => {
  it('reports no container where `navigator` itself is absent (the Node test layers)', () => {
    expect(readServiceWorkerContainer({})).toBeUndefined();
  });

  it('reports no container on a browser that exposes none (insecure origin, jsdom)', () => {
    expect(readServiceWorkerContainer({ navigator: {} })).toBeUndefined();
  });

  it('returns the container a supporting browser exposes', () => {
    const container: ContainerStub = makeContainer();

    expect(
      readServiceWorkerContainer({ navigator: { serviceWorker: asContainer(container) } })
    ).toBe(asContainer(container));
  });
});

describe('shouldRegisterServiceWorker', () => {
  it('refuses when the browser has no container to register against', () => {
    expect(shouldRegisterServiceWorker(undefined, true)).toBe(false);
  });

  it('refuses outside a production build', () => {
    // A worker installed by `next dev` would serve its shell across HMR reloads and mask a
    // genuinely broken dev build.
    expect(shouldRegisterServiceWorker(asContainer(makeContainer()), false)).toBe(false);
  });

  it('accepts a supporting browser in a production build', () => {
    expect(shouldRegisterServiceWorker(asContainer(makeContainer()), true)).toBe(true);
  });
});

describe('registerServiceWorker', () => {
  it('registers the worker from the origin root so its scope covers every route', () => {
    const container: ContainerStub = makeContainer();
    registerServiceWorker(asContainer(container));

    expect(container.register).toHaveBeenCalledWith('/sw.js');
  });

  it('stays silent for the visitor but reports a failed registration', async () => {
    const failure: Error = new Error('SecurityError: the operation is insecure');
    const container: ContainerStub = makeContainer();
    container.register.mockRejectedValue(failure);

    registerServiceWorker(asContainer(container));
    await Promise.resolve();

    expect(mockedCaptureException).toHaveBeenCalledWith(failure);
  });

  it('reports nothing when registration succeeds', async () => {
    const container: ContainerStub = makeContainer();
    registerServiceWorker(asContainer(container));
    await Promise.resolve();

    expect(mockedCaptureException).not.toHaveBeenCalled();
  });
});

describe('whenLoaded', () => {
  it('runs immediately when the document already finished loading', () => {
    // `_app`'s effect can run after `load` has already fired; waiting on the event then
    // would silently never register the worker.
    stubReadyState('complete');
    const run: jest.Mock = jest.fn();

    whenLoaded(run);

    expect(run).toHaveBeenCalledTimes(1);
  });

  it('waits for `load` while the document is still loading, then runs once', () => {
    stubReadyState('loading');
    const run: jest.Mock = jest.fn();

    whenLoaded(run);
    expect(run).not.toHaveBeenCalled();

    globalThis.dispatchEvent(new Event('load'));
    globalThis.dispatchEvent(new Event('load'));

    expect(run).toHaveBeenCalledTimes(1);
  });
});

describe('initServiceWorker', () => {
  it('does nothing on a browser without service-worker support', () => {
    stubReadyState('complete');

    withProductionBuild(() => {
      initServiceWorker();
    });

    expect(mockedCaptureException).not.toHaveBeenCalled();
  });

  it('does not register outside a production build', () => {
    const container: ContainerStub = makeContainer();
    stubNavigatorContainer(container);
    stubReadyState('complete');

    // Jest runs with NODE_ENV=test, so the production gate rejects the call.
    initServiceWorker();

    expect(container.register).not.toHaveBeenCalled();
  });

  it('registers once the page has loaded in a production build', () => {
    const container: ContainerStub = makeContainer();
    stubNavigatorContainer(container);
    stubReadyState('loading');

    withProductionBuild(() => {
      initServiceWorker();
    });
    expect(container.register).not.toHaveBeenCalled();

    globalThis.dispatchEvent(new Event('load'));

    expect(container.register).toHaveBeenCalledWith('/sw.js');
  });
});
