/**
 * Integration coverage for the route → locale rule (`src/config/locales.ts`).
 *
 * The rule is pure, so this layer's job is the 100% sweep: every branch of the three
 * resolvers — the `/en` prefix, the English-only `/swagger` exemption, the default, the
 * trailing-slash normalisation and the empty pathname — plus the alternate set the two
 * landings publish. `src/test/unit/i18n/route-locale.test.ts` holds the behavioural matrix.
 *
 * Permission / auth — Not applicable: a pure function of the pathname.
 * Loading / error — Not applicable: synchronous, throws on nothing.
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

describe('integration: route locale', () => {
  it('derives the default locale from the environment pin', () => {
    expect(DEFAULT_LOCALE).toBe(env.NEXT_PUBLIC_MAIN_LANGUAGE);
  });

  it('resolves the prefix, the English-only exemption and the default', () => {
    expect(ENGLISH_ONLY_ROUTES.has('/swagger')).toBe(true);
    expect(resolveRouteLocale(EN_ROUTE_PREFIX)).toBe(EN_LOCALE);
    expect(resolveRouteLocale('/en/docs/api/')).toBe(EN_LOCALE);
    expect(resolveRouteLocale('/swagger')).toBe(EN_LOCALE);
    expect(resolveRouteLocale('/')).toBe(DEFAULT_LOCALE);
    expect(resolveRouteLocale('')).toBe(DEFAULT_LOCALE);
    expect(resolveRouteLocale('/english')).toBe(DEFAULT_LOCALE);
  });

  it('keeps navigation inside the locale prefix', () => {
    expect(landingPathOf('/en/docs/api')).toBe(EN_ROUTE_PREFIX);
    expect(landingPathOf('/swagger')).toBe('/');
    expect(isLandingPath('/en/')).toBe(true);
    expect(isLandingPath('/')).toBe(true);
    expect(isLandingPath('/en/docs/api')).toBe(false);
  });

  it('publishes both landings and an x-default as alternates', () => {
    expect(LANDING_ALTERNATES.map(alternate => alternate.hreflang)).toEqual([
      DEFAULT_LOCALE,
      EN_LOCALE,
      'x-default',
    ]);
  });
});
