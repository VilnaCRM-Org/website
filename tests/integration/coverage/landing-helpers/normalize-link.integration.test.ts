import normalizeLink from '../../../../src/features/landing/helpers/normalizeLink';

describe('integration: normalizeLink', () => {
  it('removes only the leading hash character', () => {
    expect(normalizeLink('#test')).toBe('test');
  });

  it('preserves inner hash characters', () => {
    expect(normalizeLink('#test#section')).toBe('test#section');
  });

  it('does not strip non-leading hash characters', () => {
    expect(normalizeLink('test#section')).toBe('test#section');
  });

  it('strips a single leading hash from multiple leading hashes', () => {
    expect(normalizeLink('##test')).toBe('#test');
  });

  it('handles links without a hash', () => {
    expect(normalizeLink('test')).toBe('test');
  });

  it('converts the result to lowercase', () => {
    expect(normalizeLink('#TEST#SECTION')).toBe('test#section');
  });

  it('handles the empty string', () => {
    expect(normalizeLink('')).toBe('');
  });

  it('handles a hash-only string', () => {
    expect(normalizeLink('#')).toBe('');
  });
});
