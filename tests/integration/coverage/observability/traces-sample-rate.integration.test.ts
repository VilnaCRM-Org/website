import {
  DEVELOPMENT_TRACES_SAMPLE_RATE,
  PRODUCTION_TRACES_SAMPLE_RATE,
  resolveTracesSampleRate,
} from '@/lib/telemetry/traces-sample-rate';

const RATE_KEY = 'NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE';

async function resolveFromEnv(raw: string, environment: string): Promise<number> {
  const original = process.env[RATE_KEY];
  process.env[RATE_KEY] = raw;
  try {
    let rate!: number;
    await jest.isolateModulesAsync(async () => {
      const { env } = await import('@/config/env');
      rate = resolveTracesSampleRate(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, environment);
    });
    return rate;
  } finally {
    if (original === undefined) delete process.env[RATE_KEY];
    else process.env[RATE_KEY] = original;
  }
}

describe('integration: Sentry trace sample rate from the environment', () => {
  it('uses the configured rate in production and development alike', async () => {
    await expect(resolveFromEnv('0.05', 'production')).resolves.toBe(0.05);
    await expect(resolveFromEnv('0.5', 'development')).resolves.toBe(0.5);
  });

  it('falls back to the per-environment default when the variable is empty', async () => {
    await expect(resolveFromEnv('', 'production')).resolves.toBe(PRODUCTION_TRACES_SAMPLE_RATE);
    await expect(resolveFromEnv('', 'development')).resolves.toBe(
      DEVELOPMENT_TRACES_SAMPLE_RATE
    );
    expect(PRODUCTION_TRACES_SAMPLE_RATE).toBeLessThanOrEqual(0.2);
  });

  it('rejects a rate outside 0..1 at load, so the build fails instead of shipping it', async () => {
    await expect(resolveFromEnv('2', 'production')).rejects.toThrow(new RegExp(RATE_KEY));
  });
});
