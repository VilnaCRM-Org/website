/**
 * Boots the mock side of the parity pair, in-process.
 *
 * `Mockoon.Dockerfile` runs `mockoon-cli start --data <openapi.json>`. The CLI
 * is a thin oclif wrapper over `@mockoon/commons-server`: it calls the same
 * `OpenAPIConverter` to turn the OpenAPI document into a Mockoon environment
 * and the same `MockoonServer` to serve it. Driving those two classes directly
 * runs the identical conversion and serving code without Docker, so the parity
 * gate needs nothing beyond `bun install` — while
 * `mockoon-pin-parity.contract.test.ts` keeps the library version locked to the
 * CLI version the image installs, so "identical" stays true.
 *
 * Mockoon generates response bodies from the *schema*, not the `example` —
 * strings come back empty and booleans are randomised on every boot. That is
 * why the parity rules assert shape, never values.
 */
import { createServer } from 'node:net';
import type { AddressInfo } from 'node:net';

import { MockoonServer, OpenAPIConverter } from '@mockoon/commons-server';

import {
  exampleRequestBody,
  type ContractOperation,
  type OperationObject,
} from './openapi-contract';
import type { ObservedResponse } from './response-parity';

/** Path parameter stand-in. Mockoon routes on the path *pattern*, so the value is arbitrary. */
export const SAMPLE_PATH_PARAM = '018dd6ba-e901-7a8c-b27d-65d122caca6b';

/**
 * Mockoon fills schema-generated fields through faker, so `confirmed` and
 * `expires_in` differ between two consecutive requests. Seeding makes a failure
 * reproducible from the CI log. It does not weaken the gate: every rule here
 * asserts shape, never a value.
 */
const FAKER_SEED = 350;

export interface MockoonHandle {
  readonly baseUrl: string;
  stop(): Promise<void>;
}

/** How many times to re-draw a port before giving up. */
const PORT_ATTEMPTS = 5;

/** Upper bound on teardown, so a server that never emits `stopped` cannot hang the run. */
const STOP_TIMEOUT_MS = 5_000;

/**
 * Asks the OS for an unused port so parallel Jest workers never collide.
 *
 * Binds the **wildcard** address, not `127.0.0.1`: MockoonServer binds the
 * wildcard too, and a loopback-only probe proves nothing about it — a port free
 * on `127.0.0.1` can still be taken on `::1` or another interface, and the real
 * bind then fails.
 */
async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

async function listen(dataFilePath: string, port: number): Promise<MockoonServer> {
  const environment = await new OpenAPIConverter().convertFromOpenAPI(dataFilePath, port);

  if (environment === null) {
    throw new Error(`Mockoon could not convert ${dataFilePath} into an environment`);
  }

  const server = new MockoonServer(environment, { fakerOptions: { seed: FAKER_SEED } });
  // MockoonServer is an EventEmitter: without an `error` listener Node rethrows
  // every recoverable server error (a malformed request body, for one) as an
  // unhandled 'error' event and tears down the Jest worker. It is also how a
  // failed bind surfaces — as an event, never a thrown exception, so the boot
  // promise below must settle on it or it would hang until the Jest timeout.
  server.on('error', () => {});

  await new Promise<void>((resolve, reject) => {
    server.once('started', resolve);
    server.once('error', (code, originalError) =>
      reject(originalError ?? new Error(`Mockoon failed to start on port ${port} (${code})`))
    );
    server.start();
  });

  return server;
}

/** Converts an OpenAPI document into a Mockoon environment and serves it on a free port. */
export async function startMockoon(dataFilePath: string): Promise<MockoonHandle> {
  let lastError: unknown;

  // Reserving a port and binding it are two steps, so another process can take
  // it in between. Re-draw rather than fail: parallel Jest workers each boot
  // their own server, and a flaky gate is a gate people learn to ignore.
  for (let attempt = 0; attempt < PORT_ATTEMPTS; attempt += 1) {
    const port = await reservePort();
    try {
      const server = await listen(dataFilePath, port);
      return {
        baseUrl: `http://127.0.0.1:${port}`,
        // Settles on `error` and on a deadline as well as on `stopped`: waiting
        // for `stopped` alone would hang `afterAll` forever if the server errors
        // on the way down, and Jest has no `forceExit` here — a hung teardown
        // costs the whole job's timeout rather than one clear failure.
        stop: () =>
          new Promise<void>(resolve => {
            let deadline: NodeJS.Timeout | undefined;
            const settle = (): void => {
              if (deadline !== undefined) clearTimeout(deadline);
              resolve();
            };
            deadline = setTimeout(settle, STOP_TIMEOUT_MS);
            deadline.unref();
            server.once('stopped', settle);
            server.once('error', settle);
            server.stop();
          }),
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    `Mockoon could not bind a free port in ${PORT_ATTEMPTS} attempts: ${String(lastError)}`
  );
}

function requestInit(operation: OperationObject, method: string): RequestInit {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const example = exampleRequestBody(operation);

  if (example === undefined) {
    return { method, headers, redirect: 'manual' };
  }

  headers['Content-Type'] = example.contentType;
  return { method, headers, body: example.body, redirect: 'manual' };
}

/**
 * Replays one contract operation against the running mock and captures the
 * response. `redirect: 'manual'` keeps a 302 observable instead of following it.
 */
export async function replayOperation(
  baseUrl: string,
  { method, path, operation }: ContractOperation
): Promise<ObservedResponse> {
  const url = `${baseUrl}${path.replace(/\{[^}]+\}/g, SAMPLE_PATH_PARAM)}`;
  const response = await fetch(url, requestInit(operation, method.toUpperCase()));

  return {
    status: response.status,
    contentType: (response.headers.get('content-type') ?? '').split(';')[0]?.trim() ?? '',
    body: await response.text(),
  };
}
