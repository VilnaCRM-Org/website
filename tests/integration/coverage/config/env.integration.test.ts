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

  /**
   * Transport guard (#378 F1). The sign-up form POSTs a plaintext password to
   * the GraphQL endpoint, so a remote cleartext value must fail the build
   * rather than ship. Loopback stays allowed — the dev and Docker stacks run
   * there and there is no network hop to intercept.
   */
  describe('credential endpoint transport', () => {
    it('rejects a remote http:// GraphQL endpoint', async () => {
      process.env.NEXT_PUBLIC_GRAPHQL_API_URL = 'http://api.example.com/graphql';

      await expect(import('@/config/env')).rejects.toThrow(/NEXT_PUBLIC_GRAPHQL_API_URL/);
      await expect(import('@/config/env')).rejects.toThrow(/https/);
    });

    it('rejects a remote http:// API endpoint', async () => {
      process.env.NEXT_PUBLIC_API_URL = 'http://api.example.com';

      await expect(import('@/config/env')).rejects.toThrow(/NEXT_PUBLIC_API_URL/);
    });

    it('accepts an https endpoint', async () => {
      process.env.NEXT_PUBLIC_GRAPHQL_API_URL = 'https://api.example.com/graphql';

      const { env } = await import('@/config/env');

      expect(env.NEXT_PUBLIC_GRAPHQL_API_URL).toBe('https://api.example.com/graphql');
    });

    it.each([
      ['http://localhost:4000/graphql'],
      ['http://127.0.0.1:4000/graphql'],
      ['http://[::1]:4000/graphql'],
      // No path, and a query or fragment straight after the authority.
      ['http://localhost:4000'],
      ['http://localhost:4000?trace=1'],
      ['http://localhost#anchor'],
    ])('accepts the loopback endpoint %s', async (endpoint: string) => {
      process.env.NEXT_PUBLIC_GRAPHQL_API_URL = endpoint;

      const { env } = await import('@/config/env');

      expect(env.NEXT_PUBLIC_GRAPHQL_API_URL).toBe(endpoint);
    });

    it.each([
      ['http://localhost.attacker.example/graphql'],
      ['http://127.0.0.1.attacker.example/graphql'],
      ['http://user:pass@localhost/graphql'],
      ['ftp://localhost/graphql'],
      ['ws://localhost/graphql'],
    ])('does not accept %s as loopback cleartext', async (endpoint: string) => {
      process.env.NEXT_PUBLIC_GRAPHQL_API_URL = endpoint;

      await expect(import('@/config/env')).rejects.toThrow(/NEXT_PUBLIC_GRAPHQL_API_URL/);
    });
  });
});
