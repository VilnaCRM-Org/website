/**
 * Coverage for the offline-shell service worker shipped at `public/sw.js` (issue #338).
 *
 * The worker is copied verbatim into the static export: nothing in `src/` imports it, so it
 * is invisible to the client, server and integration coverage scopes and would otherwise
 * ship with exactly the zero coverage issue #349 closed for the CloudFront handler. It is
 * loaded here the same way — `node:fs` + `node:vm` with the real path as the vm `filename`,
 * so the v8 provider attributes the executed code back to the source file and the `edge`
 * layer's 100% per-file gate applies to the byte-identical shipped artifact.
 *
 * The service-worker globals do not exist in Node, so the vm context supplies them. The
 * assertions pin the two properties the rest of the test estate depends on:
 *   - exactly ONE url is precached (a hashed `_next/static` chunk would go stale on the
 *     next deploy and be served forever);
 *   - `respondWith` is never called for anything but a same-origin navigation, which is
 *     what leaves the Playwright `page.route` mocks and every cross-origin link untouched.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const WORKER_PATH: string = path.resolve(__dirname, '../../../public/sw.js');

// Kept in lockstep with `public/sw.js`. Bumping the generation is a deliberate change (it
// discards every visitor's precache), so it must be acknowledged in both files.
const CACHE: string = 'vilnacrm-offline-v1';
const OFFLINE_URL: string = '/offline.html';
const ORIGIN: string = 'https://vilnacrm.com';

interface PrecachedRequest {
  url: string;
  cacheMode: string;
}

interface SynthesizedResponse {
  body: string;
  status: number;
  statusText: string;
  headers: Record<string, string>;
}

// `new F(...)` on a plain function that returns an object evaluates to that object, so the
// two constructible worker globals are modelled as factories rather than classes — neither
// fake needs identity or prototype behaviour, and airbnb allows one class per file.
function fakeRequest(url: string, init: { cache: string }): PrecachedRequest {
  return { url, cacheMode: init.cache };
}

function fakeResponse(
  body: string,
  init: { status: number; statusText: string; headers: Record<string, string> }
): SynthesizedResponse {
  return { body, status: init.status, statusText: init.statusText, headers: init.headers };
}

type WorkerListener = (event: unknown) => void;

interface LifecycleEvent {
  waitUntil: jest.Mock;
}

interface WorkerFetchEvent {
  request: { url: string; mode: string };
  respondWith: jest.Mock;
}

const listeners: Record<string, WorkerListener | undefined> = {};

const cache: { add: jest.Mock } = { add: jest.fn() };

const caches: { open: jest.Mock; keys: jest.Mock; delete: jest.Mock; match: jest.Mock } = {
  open: jest.fn(),
  keys: jest.fn(),
  delete: jest.fn(),
  match: jest.fn(),
};

const sandbox = {
  // A plain function rather than a `jest.fn()`: `clearMocks` wipes recorded calls before
  // every test, but the worker registers its listeners once, at load time.
  addEventListener: (type: string, listener: WorkerListener): void => {
    listeners[type] = listener;
  },
  caches,
  clients: { claim: jest.fn() },
  skipWaiting: jest.fn(),
  location: { origin: ORIGIN },
  fetch: jest.fn(),
  URL,
  Request: fakeRequest,
  Response: fakeResponse,
};

vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(WORKER_PATH, 'utf8'), sandbox, { filename: WORKER_PATH });

function listenerFor(type: string): WorkerListener {
  const listener: WorkerListener | undefined = listeners[type];
  if (listener === undefined) {
    throw new Error(`public/sw.js registered no "${type}" listener`);
  }
  return listener;
}

function firstArgument(mock: jest.Mock): unknown {
  const [call] = mock.mock.calls;
  if (call === undefined) {
    throw new Error('the worker did not call the expected event method');
  }
  return call[0];
}

function lifecycleEvent(): LifecycleEvent {
  return { waitUntil: jest.fn() };
}

function fetchEvent(url: string, mode: string): WorkerFetchEvent {
  return { request: { url, mode }, respondWith: jest.fn() };
}

async function dispatchNavigation(url: string): Promise<unknown> {
  const event: WorkerFetchEvent = fetchEvent(url, 'navigate');
  listenerFor('fetch')(event);
  return firstArgument(event.respondWith);
}

beforeEach(() => {
  caches.open.mockResolvedValue(cache);
  caches.keys.mockResolvedValue([]);
  caches.delete.mockResolvedValue(true);
  caches.match.mockResolvedValue(undefined);
  cache.add.mockResolvedValue(undefined);
  sandbox.fetch.mockResolvedValue({ body: 'from the network' });
});

describe('install', () => {
  it('precaches exactly the offline shell, bypassing the HTTP cache', async () => {
    const event: LifecycleEvent = lifecycleEvent();
    listenerFor('install')(event);
    await firstArgument(event.waitUntil);

    expect(caches.open).toHaveBeenCalledWith(CACHE);
    expect(cache.add).toHaveBeenCalledTimes(1);
    expect(cache.add).toHaveBeenCalledWith({ url: OFFLINE_URL, cacheMode: 'reload' });
  });

  it('activates immediately instead of waiting for every tab to close', async () => {
    const event: LifecycleEvent = lifecycleEvent();
    listenerFor('install')(event);
    await firstArgument(event.waitUntil);

    expect(sandbox.skipWaiting).toHaveBeenCalledTimes(1);
  });
});

describe('activate', () => {
  it('evicts its own stale generations and leaves other owners alone', async () => {
    // The whole origin shares one CacheStorage, so deleting every key that is not
    // the current one would destroy caches another feature owns.
    caches.keys.mockResolvedValue(['vilnacrm-offline-v0', CACHE, 'some-unrelated-cache']);
    const event: LifecycleEvent = lifecycleEvent();
    listenerFor('activate')(event);
    await firstArgument(event.waitUntil);

    expect(caches.delete).toHaveBeenCalledWith('vilnacrm-offline-v0');
    expect(caches.delete).not.toHaveBeenCalledWith('some-unrelated-cache');
    expect(caches.delete).not.toHaveBeenCalledWith(CACHE);
    expect(caches.delete).toHaveBeenCalledTimes(1);
  });

  it('claims already-open clients so the first offline navigation is covered', async () => {
    const event: LifecycleEvent = lifecycleEvent();
    listenerFor('activate')(event);
    await firstArgument(event.waitUntil);

    expect(sandbox.clients.claim).toHaveBeenCalledTimes(1);
  });
});

describe('fetch', () => {
  it('passes a working network response straight through', async () => {
    const live: { body: string } = { body: 'live document' };
    sandbox.fetch.mockResolvedValue(live);

    await expect(dispatchNavigation(`${ORIGIN}/`)).resolves.toBe(live);
    expect(caches.match).not.toHaveBeenCalled();
  });

  it('serves the precached shell when the navigation fails', async () => {
    const shell: { body: string } = { body: 'offline shell' };
    sandbox.fetch.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));
    caches.match.mockResolvedValue(shell);

    await expect(dispatchNavigation(`${ORIGIN}/swagger`)).resolves.toBe(shell);
    expect(caches.match).toHaveBeenCalledWith(OFFLINE_URL);
  });

  it('synthesizes a shell when the precache is gone, never a network error', async () => {
    sandbox.fetch.mockRejectedValue(new Error('net::ERR_INTERNET_DISCONNECTED'));
    caches.match.mockResolvedValue(undefined);

    const served: SynthesizedResponse = (await dispatchNavigation(
      `${ORIGIN}/`
    )) as SynthesizedResponse;

    expect(served.status).toBe(503);
    expect(served.statusText).toBe('Service Unavailable');
    expect(served.headers['content-type']).toBe('text/html; charset=utf-8');
    expect(served.body).toContain('offline');
  });

  it.each([
    ['a subresource fetch', `${ORIGIN}/api/graphql`, 'cors'],
    ['a same-origin no-cors asset', `${ORIGIN}/_next/static/chunk.js`, 'no-cors'],
    ['a cross-origin navigation', 'https://github.com/VilnaCRM-Org', 'navigate'],
  ])('leaves %s entirely to the browser', (_label, url, mode) => {
    const event: WorkerFetchEvent = fetchEvent(url, mode);
    listenerFor('fetch')(event);

    expect(event.respondWith).not.toHaveBeenCalled();
    expect(sandbox.fetch).not.toHaveBeenCalled();
    expect(caches.match).not.toHaveBeenCalled();
  });
});
