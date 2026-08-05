import {
  BLANK_TARGET,
  REQUIRED_BLANK_REL_TOKENS,
  resolveExternalLinkRel,
} from '@/shared/externalLinkRel';

/**
 * Regression coverage for the new-tab link hardening (#382 F2).
 *
 * Positive: a `_blank` link always ends up with both tokens.
 * Negative / boundary: same-tab links are left alone, an existing `rel` is
 * extended rather than replaced, and already-hardened links are not duplicated.
 */
describe('resolveExternalLinkRel', () => {
  it('adds both tokens to a new-tab link that has no rel', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET)).toBe('noopener noreferrer');
  });

  it('treats a case-variant blank target as a new-tab link', () => {
    expect(resolveExternalLinkRel('_BLANK')).toBe('noopener noreferrer');
    expect(resolveExternalLinkRel('_Blank', 'nofollow')).toBe('nofollow noopener noreferrer');
  });

  it('leaves a same-tab link untouched', () => {
    expect(resolveExternalLinkRel(undefined, undefined)).toBeUndefined();
    expect(resolveExternalLinkRel('_self')).toBeUndefined();
    expect(resolveExternalLinkRel('_self', 'nofollow')).toBe('nofollow');
  });

  it('keeps a caller-supplied rel and appends only what is missing', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET, 'nofollow')).toBe('nofollow noopener noreferrer');
    expect(resolveExternalLinkRel(BLANK_TARGET, 'noopener')).toBe('noopener noreferrer');
  });

  it('does not duplicate tokens that are already present, in any order', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET, 'noreferrer noopener')).toBe('noreferrer noopener');
    expect(resolveExternalLinkRel(BLANK_TARGET, 'noopener noreferrer')).toBe('noopener noreferrer');
  });

  it('normalises irregular whitespace in the supplied rel', () => {
    expect(resolveExternalLinkRel(BLANK_TARGET, '  nofollow   noopener  ')).toBe(
      'nofollow noopener noreferrer'
    );
    expect(resolveExternalLinkRel(BLANK_TARGET, '')).toBe('noopener noreferrer');
  });

  it('requires exactly the two tokens the hardening depends on', () => {
    expect([...REQUIRED_BLANK_REL_TOKENS]).toEqual(['noopener', 'noreferrer']);
  });
});
