import normalizeLink from '../../features/landing/helpers/normalizeLink';

describe('normalizeLink', () => {
  it('removes only leading hash character', () => {
    expect(normalizeLink('#test')).toBe('test');
  });

  it('preserves inner hash characters', () => {
    expect(normalizeLink('#test#section')).toBe('test#section');
  });

  it('handles multiple leading hashes correctly', () => {
    expect(normalizeLink('##test')).toBe('#test');
  });

  it('handles links without hash', () => {
    expect(normalizeLink('test')).toBe('test');
  });

  it('converts to lowercase', () => {
    expect(normalizeLink('#TEST#SECTION')).toBe('test#section');
  });

  it('handles empty string', () => {
    expect(normalizeLink('')).toBe('');
  });

  it('handles hash-only string', () => {
    expect(normalizeLink('#')).toBe('');
  });
});
