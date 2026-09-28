/**
 * Integration: the palette and breakpoint values the toolkit seams now supply.
 *
 * `ui-color-theme/index.ts` and `ui-breakpoints/index.ts` both claim in prose
 * that the toolkit's values are identical to the ones this site shipped before
 * the swap. Nothing asserted that, which made the claim unfalsifiable: a
 * reviewed version bump that moved a token would pass every gate in the
 * repository, because the SHA-256 integrity gate only catches UNREVIEWED byte
 * drift and dependency-cruiser only sees the import.
 *
 * These are the values read off `origin/main`'s own `createTheme` call at the
 * commit this migration replaced, so the assertion is a real comparison against
 * what shipped rather than a restatement of whatever the toolkit happens to
 * export today.
 */
import UiBreakpoints from '@/components/ui-breakpoints';
import UiColorTheme from '@/components/ui-color-theme';

const SHIPPED_PALETTE: Readonly<Record<string, string>> = {
  primary: '#1EAEFF',
  secondary: '#FFC01E',
  error: '#DC3939',
  white: '#FFF',
  darkPrimary: '#1A1C1E',
  darkSecondary: '#1B2327',
  brandGray: '#E1E7EA',
  grey200: '#404142',
  grey250: '#57595B',
  grey300: '#969B9D',
  grey400: '#D0D4D8',
  grey500: '#EAECEE',
  backgroundGrey100: '#FBFBFB',
  backgroundGrey200: '#f4f5f6',
  backgroundGrey300: '#F5F6F7',
  containedButtonHover: '#00A3FF',
  containedButtonActive: '#0399ED',
  notchDeskBefore: '#080805',
  notchDeskAfter: '#0e314c',
  notchMobileBefore: '#0c0b0e',
  notchMobileAfter: '#0f0b25',
  textLinkHover: '#297FFF',
  textLinkActive: '#0399ED',
};

const SHIPPED_BREAKPOINTS: Readonly<Record<string, number>> = {
  xs: 375,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1440,
};

describe('toolkit theme contract', () => {
  it('keeps every palette token the site shipped before the swap', () => {
    const palette = UiColorTheme.palette as unknown as Record<string, { main: string }>;

    Object.entries(SHIPPED_PALETTE).forEach(([token, value]) => {
      expect(palette[token]?.main).toBe(value);
    });
  });

  it('covers every token the pre-swap palette declared, so none was silently dropped', () => {
    const palette = UiColorTheme.palette as unknown as Record<string, unknown>;

    expect(Object.keys(SHIPPED_PALETTE).filter(token => !(token in palette))).toEqual([]);
  });

  it('keeps the breakpoint scale byte-for-byte', () => {
    Object.entries(SHIPPED_BREAKPOINTS).forEach(([name, value]) => {
      expect(UiBreakpoints.breakpoints.values[name as 'xs']).toBe(value);
    });
  });
});
