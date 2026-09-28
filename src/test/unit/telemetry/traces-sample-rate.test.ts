import {
  DEVELOPMENT_TRACES_SAMPLE_RATE,
  PRODUCTION_TRACES_SAMPLE_RATE,
  resolveTracesSampleRate,
} from '@/lib/telemetry/traces-sample-rate';

const RATE_KEY = 'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE';

async function importEnvWithRate(
  value: string | undefined
): Promise<typeof import('@/config/env')> {
  const original = process.env[RATE_KEY];
  if (value === undefined) delete process.env[RATE_KEY];
  else process.env[RATE_KEY] = value;
  try {
    let moduleExports!: typeof import('@/config/env');
    await jest.isolateModulesAsync(async () => {
      moduleExports = await import('@/config/env');
    });
    return moduleExports;
  } finally {
    if (original === undefined) delete process.env[RATE_KEY];
    else process.env[RATE_KEY] = original;
  }
}

/**
 * Permission / auth — Not applicable: build-time config, no user or role state.
 * Loading / retry — Not applicable: synchronous parse at module load.
 */
describe('resolveTracesSampleRate', () => {
  it('uses a configured rate in every environment', () => {
    expect(resolveTracesSampleRate(0.05, 'production')).toBe(0.05);
    expect(resolveTracesSampleRate(0.5, 'development')).toBe(0.5);
  });

  it('falls back to the production default of at most 0.2 when unset', () => {
    expect(resolveTracesSampleRate('', 'production')).toBe(PRODUCTION_TRACES_SAMPLE_RATE);
    expect(PRODUCTION_TRACES_SAMPLE_RATE).toBe(0.1);
    expect(PRODUCTION_TRACES_SAMPLE_RATE).toBeLessThanOrEqual(0.2);
  });

  it('traces every page load in development when unset', () => {
    expect(resolveTracesSampleRate('', 'development')).toBe(DEVELOPMENT_TRACES_SAMPLE_RATE);
    expect(DEVELOPMENT_TRACES_SAMPLE_RATE).toBe(1);
  });

  it('keeps an explicit 0, which switches tracing off, instead of the default', () => {
    expect(resolveTracesSampleRate(0, 'production')).toBe(0);
    expect(resolveTracesSampleRate(1, 'production')).toBe(1);
  });
});

describe(`${RATE_KEY} in the client env schema`, () => {
  it.each([
    ['0.2', 0.2],
    [' 0.05 ', 0.05],
    ['0', 0],
    ['1', 1],
  ])('parses %j as the number %p', async (raw: string, expected: number) => {
    const { env } = await importEnvWithRate(raw);

    expect(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE).toBe(expected);
  });

  it.each([[undefined], [''], ['   ']])('reads %j as unset', async (raw: string | undefined) => {
    const { env } = await importEnvWithRate(raw);

    expect(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE).toBe('');
  });

  it.each([['1.01'], ['-0.1'], ['ten percent'], ['10%']])(
    'fails the build on %j',
    async (raw: string) => {
      await expect(importEnvWithRate(raw)).rejects.toThrow(new RegExp(RATE_KEY));
    }
  );
});
