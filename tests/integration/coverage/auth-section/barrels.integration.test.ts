/**
 * Integration coverage: AuthSection barrels and orphaned style modules.
 *
 * The default-export barrels (`AuthSection/index.ts`, `AuthForm/index.ts`) and
 * the unused `SocialItem/styles.ts` (`export default {}`) are not reached
 * transitively by rendering, so they are imported directly here to execute their
 * module bodies and count toward coverage.
 */
import authSection from '../../../../src/features/landing/components/AuthSection';
import authLayout from '../../../../src/features/landing/components/AuthSection/AuthForm';
import socialItemStyles from '../../../../src/features/landing/components/AuthSection/SocialItem/styles';

describe('integration: AuthSection barrels', () => {
  it('re-exports the AuthSection and AuthLayout default components', () => {
    expect(authSection).toBeDefined();
    expect(typeof authSection).toBe('function');
    expect(authLayout).toBeDefined();
    expect(typeof authLayout).toBe('function');
  });

  it('exposes the (empty) SocialItem styles object', () => {
    expect(socialItemStyles).toEqual({});
  });
});
