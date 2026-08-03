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

/** Asks the OS for an unused port so parallel Jest workers never collide. */
async function reservePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as AddressInfo;
      probe.close(() => resolve(port));
    });
  });
}

/** Converts an OpenAPI document into a Mockoon environment and serves it on a free port. */
export async function startMockoon(dataFilePath: string): Promise<MockoonHandle> {
  const port = await reservePort();
  const environment = await new OpenAPIConverter().convertFromOpenAPI(dataFilePath, port);

  if (environment === null) {
    throw new Error(`Mockoon could not convert ${dataFilePath} into an environment`);
  }

  const server = new MockoonServer(environment, { fakerOptions: { seed: FAKER_SEED } });
  // MockoonServer is an EventEmitter: without an `error` listener Node rethrows
  // every recoverable server error (a malformed request body, for one) as an
  // unhandled 'error' event and tears down the Jest worker.
  server.on('error', () => {});

  await new Promise<void>((resolve, reject) => {
    server.once('started', resolve);
    server.once('error', (_code, originalError) =>
      reject(originalError ?? new Error(`Mockoon failed to start on port ${port}`))
    );
    server.start();
  });

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    stop: () =>
      new Promise<void>(resolve => {
        server.once('stopped', resolve);
        server.stop();
      }),
  };
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
