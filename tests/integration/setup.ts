/**
 * Integration-layer test setup.
 *
 * Runs before `jest.setup.ts` (jest-dom matchers + i18next bootstrap) for the
 * `TEST_ENV=integration` Jest project: the GraphQL endpoint must be set before
 * i18next boots src/config/env.ts, which validates and freezes
 * NEXT_PUBLIC_GRAPHQL_API_URL once at module load (#328).
 *
 * Integration tests exercise the *real* Apollo Client transport
 * (`src/features/landing/api/graphql/apollo.ts`) and the real cross-module
 * wiring around it, while stubbing the single external resource — the network —
 * at the `fetch` boundary. No HTTP server is contacted, so the GraphQL endpoint
 * only needs to be stable and well-formed.
 *
 * The endpoint is forced here (rather than relying on `.env` expansion, which
 * leaves `${WEBSITE_DOMAIN}` unset under Jest) so that request-contract
 * assertions can compare against a known URL deterministically.
 */
export const INTEGRATION_GRAPHQL_URL = 'https://graphql.integration.test/graphql';

process.env.NEXT_PUBLIC_GRAPHQL_API_URL = INTEGRATION_GRAPHQL_URL;
