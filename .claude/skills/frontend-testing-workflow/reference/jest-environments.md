# Jest Environments

One Jest config (`jest.config.ts`) drives every Jest suite; the `TEST_ENV`
environment variable selects the test env and the matching spec globs. The
Makefile sets `TEST_ENV` for you — prefer the targets over calling Jest directly.

## Client (`TEST_ENV=client`)

Default env. jsdom + React Testing Library, for components, hooks, DOM behavior,
and browser utilities. Matches `src/test/testing-library/**/*.test.tsx` plus the
shared `src/test/unit/**/*.test.ts`.

```bash
make test-unit-client
# local, no Docker:
CI=1 make test-unit-client
```

## Server (`TEST_ENV=server`)

node env, for Apollo Server resolvers and other server-side logic. Matches
`src/test/apollo-server/**/*.test.ts` plus the shared `src/test/unit/**/*.test.ts`.

```bash
make test-unit-server
CI=1 make test-unit-server
```

Run both unit envs together:

```bash
make test-unit-all
```

## Integration (`TEST_ENV=integration`)

The "missing middle" between unit and e2e: cross-module / API-boundary specs in
`tests/integration/**/*.integration.test.{ts,tsx}`. It runs the real Apollo
`HttpLink` in a jsdom variant that injects Node fetch globals, and enforces a
strict global coverage threshold of its own. Keep unit tests out of this folder —
the integration globs are deliberately isolated so unit specs cannot leak in.

```bash
make test-integration
```

## The shared `src/test/unit` folder

`src/test/unit/**/*.test.ts` runs under **both** `client` and `server`. Keep
those specs environment-agnostic — pure logic and validation helpers, no jsdom-
only or node-only globals — so the same file passes in either env. Example:
`src/test/unit/email-validation.test.ts` exercises valid, invalid, and empty
inputs in one place.

## Don't typo TEST_ENV

`jest.config.ts` fails fast on an unrecognised `TEST_ENV` instead of silently
falling back to `client`, so a mistyped CI value surfaces as an explicit error
rather than running the wrong suite.
