/**
 * Integration coverage: the shared new-tab link hardening (#382 F2).
 *
 * `UiLink` and `SocialMediaItem` both route their `rel` through this helper, so
 * every branch of the merge is exercised here against the real module rather
 * than through either component.
 */
import {
  BLANK_TARGET,
  REQUIRED_BLANK_REL_TOKENS,
  resolveExternalLinkRel,
} from '@/shared/externalLinkRel';

describe('integration: resolveExternalLinkRel', () => {
  it('returns the caller rel untouched for a same-tab link', () => {
    expect(resolveExternalLinkRel(undefined, 'nofollow')).toBe('nofollow');
    expect(resolveExternalLinkRel('_parent')).toBeUndefined();
  });

  it('supplies both tokens when a new-tab link carries no rel', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET, undefined)).toBe('noopener noreferrer');
  });

  it('merges the missing token into a partially hardened rel', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET, 'noreferrer')).toBe('noreferrer noopener');
  });

  it('is idempotent for an already hardened rel', () => {
    const hardened: string = resolveExternalLinkRel(BLANK_TARGET) as string;

    expect(resolveExternalLinkRel(BLANK_TARGET, hardened)).toBe(hardened);
  });

  it('exposes the token contract the components depend on', () => {
    expect(REQUIRED_BLANK_REL_TOKENS).toContain('noopener');
    expect(REQUIRED_BLANK_REL_TOKENS).toContain('noreferrer');
  });
});
