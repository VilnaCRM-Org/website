/**
 * Integration coverage: AuthSection barrels.
 *
 * The default-export barrels (`AuthSection/index.ts`, `AuthForm/index.ts`) are
 * not reached transitively by rendering, so they are imported directly here to
 * execute their module bodies and count toward coverage.
 */
import authSection from '@components/AuthSection';
import authLayout from '@components/AuthSection/AuthForm';

describe('integration: AuthSection barrels', () => {
  it('re-exports the AuthSection and AuthLayout default components', () => {
    expect(authSection).toBeDefined();
    expect(typeof authSection).toBe('function');
    expect(authLayout).toBeDefined();
    expect(typeof authLayout).toBe('function');
  });
});
