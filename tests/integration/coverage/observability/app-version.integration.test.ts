// `APP_ENVIRONMENT` is computed once at module load from
// `isProductionBuild()`, so each branch only surfaces by re-importing the
// module under a different `NODE_ENV`.
import { version } from '../../../../package.json';

async function importFreshAppVersion(): Promise<typeof import('@/config/app-version')> {
  let moduleExports!: typeof import('@/config/app-version');
  await jest.isolateModulesAsync(async () => {
    moduleExports = await import('@/config/app-version');
  });
  return moduleExports;
}

async function withNodeEnv<T>(value: string, run: () => Promise<T>): Promise<T> {
  const original = process.env.NODE_ENV;
  Object.defineProperty(process.env, 'NODE_ENV', { value, configurable: true });
  try {
    return await run();
  } finally {
    Object.defineProperty(process.env, 'NODE_ENV', { value: original, configurable: true });
  }
}

describe('integration: app-version config', () => {
  it('exposes the package.json version as APP_VERSION', async () => {
    const { APP_VERSION } = await importFreshAppVersion();

    expect(APP_VERSION).toBe(version);
  });

  it('resolves APP_ENVIRONMENT to "development" outside a production build', async () => {
    await withNodeEnv('test', async () => {
      const { APP_ENVIRONMENT } = await importFreshAppVersion();
      expect(APP_ENVIRONMENT).toBe('development');
    });
  });

  it('resolves APP_ENVIRONMENT to "production" during a production build', async () => {
    await withNodeEnv('production', async () => {
      const { APP_ENVIRONMENT } = await importFreshAppVersion();
      expect(APP_ENVIRONMENT).toBe('production');
    });
  });
});
