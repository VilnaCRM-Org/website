# Mockoon And Apollo

The website mocks GraphQL at two layers: a Mockoon container for end-to-end runs,
and in-process Apollo mocks for unit tests. Match the layer to the test.

## E2E backend: Mockoon

`make test-e2e` builds and starts the prod stack via `docker-compose.test.yml`,
which includes a **Mockoon** service (`website-mockoon`) that answers the app's
GraphQL and REST calls. Tests hit the running app, not a mocked module, so the
data flows through the real network boundary.

To drive a specific error, loading, or edge response in one spec, intercept the
request with Playwright instead of editing Mockoon defaults:

```ts
const handler = async route =>
  route.fulfill({
    status: 500,
    contentType: 'application/json',
    body: JSON.stringify({ errors: [{ message: 'Internal Server Error' }] }),
  });

await page.route('**/graphql', handler);
// ... exercise the flow ...
await page.unroute('**/graphql', handler);
```

Always `unroute` the handler so it does not leak into later assertions in the
same spec.

## Client unit: Apollo MockedProvider

Component tests that read GraphQL use `renderWithProviders` from
`src/test/testing-library/utils.tsx`, which wraps `MockedProvider`. Pass the
operation mocks through `apolloMocks` rather than mocking Apollo modules:

```tsx
renderWithProviders(<SignUpForm />, { apolloMocks: [createUserMock] });
```

## Server unit: standalone Apollo Server

`src/test/apollo-server` tests spin up a real Apollo Server 5 instance with
`startStandaloneServer` on `port: 0` and assert on the HTTP/GraphQL response
(`response.status`, `errors`, `data`). This is where schema loading, resolver
logic, and CSRF/validation behavior are verified.

Prefer `src/test/apollo-server/mock-server.ts` — it boots the **shipped** mock
(the resolvers, `formatError` and query guards from `docker/apollo-server`)
against the **pinned** schema `contracts/user-service/schema.graphql`, so a
regression in the thing that actually runs fails the suite. Inject a resolver
double only when the test needs to force a failure the real resolver cannot
produce (`resolverOverrides`). `server.test.ts` predates this and still builds
its own inline SDL; do not copy that shape into new specs.

## Apollo mock security invariants (issue #381)

The mock is the reference shape agents copy, so these properties are load-bearing
and every one has a spec. Do not weaken them:

- `id` is generated server-side; `clientMutationId` is an opaque echo field.
- new users are `confirmed: false`; input is allow-listed, so `id` / `confirmed`
  cannot be mass-assigned.
- `formatError` returns a stable code, a generic message, an enumerated `reason`
  and a `correlationId` — never `details`, `stacktrace`, or `error.message`.
- depth and cost `validationRules` are always installed; introspection and the
  Sandbox are on only when `NODE_ENV=development`.

The mock models query cost, not throughput. A real user-service endpoint is
additionally expected to rate-limit per client and to reject unauthenticated
mutations — do not infer from this mock that those are optional.

## Rule

Do not hide an application bug by changing the mock first. Confirm the expected
API shape (the schema, the resolver, the real response), then update the mock to
match it — never the other way around.
