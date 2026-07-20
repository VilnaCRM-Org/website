/**
 * Integration coverage for the typed config layer (`src/config/env.ts`, #328).
 *
 * `env.ts` validates `process.env` once at module load. These tests re-import it
 * in isolation to exercise both the happy path (the validated, typed object the
 * app consumes) and the fail-fast path — a missing or malformed required
 * variable must throw a descriptive error, which is what makes `next build`
 * fail loudly instead of shipping a silent production no-op.
 */
describe('config/env (integration)', () => {
  const originalGraphqlUrl: string | undefined = process.env.NEXT_PUBLIC_GRAPHQL_API_URL;
  const originalApiUrl: string | undefined = process.env.NEXT_PUBLIC_API_URL;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_GRAPHQL_API_URL = originalGraphqlUrl;
    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it('exposes the validated, typed environment', async () => {
    const { env } = await import('@/config/env');

    expect(env.NEXT_PUBLIC_GRAPHQL_API_URL).toBe(process.env.NEXT_PUBLIC_GRAPHQL_API_URL);
    expect(env.NEXT_PUBLIC_VILNACRM_GMAIL).toBe(process.env.NEXT_PUBLIC_VILNACRM_GMAIL);
    expect(env.NEXT_PUBLIC_MAIN_LANGUAGE).toBe(process.env.NEXT_PUBLIC_MAIN_LANGUAGE);
  });

  it('throws a descriptive error listing a missing required variable', async () => {
    delete process.env.NEXT_PUBLIC_GRAPHQL_API_URL;

    await expect(import('@/config/env')).rejects.toThrow(/Invalid environment configuration/);
    await expect(import('@/config/env')).rejects.toThrow(/NEXT_PUBLIC_GRAPHQL_API_URL/);
  });

  it('rejects a malformed URL variable', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'not-a-url';

    await expect(import('@/config/env')).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
  });
});
