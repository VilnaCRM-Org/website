# Integration tests

This directory holds the **integration** test layer for `website` — the
"missing middle" between fast, isolated unit tests and full browser end‑to‑end
tests. It mirrors the integration lane that `crm` already ships, adapted to this
project's boundaries (Next.js + Apollo Client + MUI + i18next).

> The point of this layer is **not** "more unit tests in a new folder". A test
> belongs here only if it crosses a real seam — multiple modules wired together,
> or the real API/transport boundary — that a unit or component test cannot
> reach.

## What counts as an integration test here

A test belongs in `tests/integration/` when it covers at least one of:

1. **Multi‑module flows** — several real modules wired together through their
   real interfaces (e.g. form → react‑hook‑form → Apollo `useMutation` →
   error mapping → notification UI), rather than a single unit with everything
   else mocked.
2. **API boundary behaviour** — the real Apollo Client transport
   (`src/features/landing/api/graphql/apollo.ts` + `HttpLink`) exercised against
   a stubbed network, asserting the actual request contract (URL, method,
   headers, body) and how real Apollo error classes (`CombinedGraphQLErrors`,
   `ServerError`) propagate through the app's error translation.
3. **SSR / server‑client seams** _(where applicable)_ — interaction between
   server‑rendered config/data and client behaviour. Add these as such seams
   appear; the initial suite focuses on the registration API boundary.

## Layer boundaries — what goes where

Each layer is defined by the single boundary it mocks:

- **Unit** (`src/test/unit`) — mocks everything except the unit under test; for
  pure functions, validators and helpers.
- **Component** (`src/test/testing-library`) — mocks the Apollo **link**
  (`MockedProvider`); a single component's rendering and interaction in isolation.
- **Integration** (`tests/integration`) — stubs only the **network** (`fetch`);
  real cross‑module wiring plus the real Apollo transport and API contract.
- **E2E** (`src/test/e2e`) — mocks nothing (real browser + built app); user
  journeys in a real browser (Playwright).

Rule of thumb:

- If you would reach for `MockedProvider` or `jest.mock` the Apollo hooks → it's
  a **component** test, not an integration test.
- If you need a running browser or the production build → it's **e2e**.
- If you want the **real client** to actually serialise a request and parse a
  real response, with only the network stubbed → it's an **integration** test.

## Conventions

- **Location:** `tests/integration/**` (grouped by seam, e.g. `api/`, `flows/`).
- **Naming:** `*.integration.test.ts` / `*.integration.test.tsx`.
- **Selection:** the `TEST_ENV=integration` Jest project (see `jest.config.ts`)
  matches only this glob — unit/component globs are excluded so integration
  cannot silently absorb them.
- **Environment:** rendered flows run in jsdom (with the Fetch API injected by
  `tests/integration/jsdom-fetch.environment.js`). Pure transport/API tests opt
  into Node with an `@jest-environment node` docblock.
- **Network boundary:** never hit a real server. Use the shared helper
  `tests/integration/utils/graphql-network.ts` to install a `fetch` stub and
  build real `Response`s. This is the website equivalent of CRM's
  `tests/integration/mocks/server.ts`.
- **Setup:** `tests/integration/setup.ts` pins a deterministic GraphQL endpoint
  so request‑contract assertions are stable.

## Running

```bash
make test-integration         # run the integration layer once
make test-integration-watch   # re-run on change (local dev)
make ci-test-integration      # CI entrypoint (runs Jest directly)
```

Under the hood each command runs Jest with `TEST_ENV=integration`.

## Current suite

- `api/registration-api.integration.test.ts` — the registration GraphQL API
  boundary: request contract, `Accept-Language` propagation, typed success
  payload, and the full error‑translation pipeline (GraphQL errors, HTTP 5xx,
  dropped connection) through the **real** Apollo client.
- `flows/registration-flow.integration.test.tsx` — the registration form
  submitted through the **real** client end‑to‑end, asserting the success/error
  notification and the cross‑module data transform (email lower‑casing,
  generated `clientMutationId`).
