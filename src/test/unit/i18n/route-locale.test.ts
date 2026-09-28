/**
 * The route → locale rule behind the `/en` landing page.
 *
 * Every page is exported in exactly one language and the language is a function of the
 * pathname alone: `/en` and everything beneath it is English, `/swagger` is English because
 * the OpenAPI reference it embeds is English-only (the rule that used to live as a
 * `changeLanguage('en')` effect inside the swagger component), and everything else is the
 * site's main language. `pages/_app.tsx` and `pages/_document.tsx` both derive from this one
 * function, so `<html lang>`, the rendered copy, `og:locale` and the hreflang alternates can
 * never disagree about which language a page is in.
 */
import { env } from '@/config/env';
import {
  DEFAULT_LOCALE,
  EN_LOCALE,
  EN_ROUTE_PREFIX,
  ENGLISH_ONLY_ROUTES,
  LANDING_ALTERNATES,
  isLandingPath,
  landingPathOf,
  resolveRouteLocale,
} from '@/config/locales';

describe('locale constants', () => {
  it('takes the default locale from the single NEXT_PUBLIC_MAIN_LANGUAGE pin', () => {
    expect(DEFAULT_LOCALE).toBe(env.NEXT_PUBLIC_MAIN_LANGUAGE);
    expect(DEFAULT_LOCALE).not.toBe(EN_LOCALE);
  });

  it('routes English under the /en prefix', () => {
    expect(EN_LOCALE).toBe('en');
    expect(EN_ROUTE_PREFIX).toBe('/en');
  });

  it('keeps /swagger as the one English-only route outside the prefix', () => {
    expect([...ENGLISH_ONLY_ROUTES]).toEqual(['/swagger']);
  });
});

describe('resolveRouteLocale', () => {
  it.each([
    ['/en', EN_LOCALE],
    ['/en/', EN_LOCALE],
    ['/en/docs/api', EN_LOCALE],
    ['/en/docs/api/', EN_LOCALE],
    ['/swagger', EN_LOCALE],
    ['/swagger/', EN_LOCALE],
  ])('resolves %s to English', (pathname, expected) => {
    expect(resolveRouteLocale(pathname)).toBe(expected);
  });

  it.each(['/', '/offline', '/404', '/500', '/english', '/enx', '/en-us', '/docs/en', '/uk'])(
    'resolves %s to the default locale',
    pathname => {
      expect(resolveRouteLocale(pathname)).toBe(DEFAULT_LOCALE);
    }
  );

  it('treats a run of trailing slashes as the bare route', () => {
    expect(resolveRouteLocale('/en//')).toBe(EN_LOCALE);
    expect(resolveRouteLocale('//')).toBe(DEFAULT_LOCALE);
    expect(resolveRouteLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('is case-sensitive, like the edge handler and the export', () => {
    expect(resolveRouteLocale('/EN')).toBe(DEFAULT_LOCALE);
    expect(resolveRouteLocale('/Swagger')).toBe(DEFAULT_LOCALE);
  });
});

describe('landingPathOf', () => {
  it.each(['/en', '/en/', '/en/docs/api', '/en/docs/api/'])(
    'sends %s to the English landing',
    pathname => {
      expect(landingPathOf(pathname)).toBe(EN_ROUTE_PREFIX);
    }
  );

  // `/swagger` renders in English but carries no locale prefix, so its logo still leads
  // to the root landing: the prefix, not the display language, is what a visitor chose.
  it.each(['/', '/swagger', '/offline', '/404', '/english', '/en-us', '/docs/en', ''])(
    'sends %s to the root landing',
    pathname => {
      expect(landingPathOf(pathname)).toBe('/');
    }
  );

  it('round-trips with resolveRouteLocale for both landings', () => {
    expect(resolveRouteLocale(landingPathOf('/en/docs/api'))).toBe(EN_LOCALE);
    expect(resolveRouteLocale(landingPathOf('/offline'))).toBe(DEFAULT_LOCALE);
  });
});

describe('isLandingPath', () => {
  it.each(['/', '/en', '/en/', '//'])('recognises %s as a landing', pathname => {
    expect(isLandingPath(pathname)).toBe(true);
  });

  it.each(['/en/docs/api', '/swagger', '/offline', '/404', '/english', '/en-us', '/index'])(
    'rejects %s',
    pathname => {
      expect(isLandingPath(pathname)).toBe(false);
    }
  );
});

describe('LANDING_ALTERNATES', () => {
  it('lists each landing once plus an x-default that points at the root', () => {
    expect(LANDING_ALTERNATES).toEqual([
      { hreflang: DEFAULT_LOCALE, path: '/' },
      { hreflang: EN_LOCALE, path: EN_ROUTE_PREFIX },
      { hreflang: 'x-default', path: '/' },
    ]);
  });

  it('points every language alternate at a path that resolves to that language', () => {
    for (const { hreflang, path } of LANDING_ALTERNATES) {
      if (hreflang !== 'x-default') {
        expect(resolveRouteLocale(path)).toBe(hreflang);
      }
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(LANDING_ALTERNATES)).toBe(true);
  });
});
