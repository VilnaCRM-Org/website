import { env } from './env';

export const DEFAULT_LOCALE: string = env.NEXT_PUBLIC_MAIN_LANGUAGE;

export const EN_LOCALE: string = 'en';

export const EN_ROUTE_PREFIX: string = '/en';

export const ENGLISH_ONLY_ROUTES: ReadonlySet<string> = new Set(['/swagger']);

export interface LocaleAlternate {
  readonly hreflang: string;
  readonly path: string;
}

export const LANDING_ALTERNATES: readonly LocaleAlternate[] = Object.freeze([
  { hreflang: DEFAULT_LOCALE, path: '/' },
  { hreflang: EN_LOCALE, path: EN_ROUTE_PREFIX },
  { hreflang: 'x-default', path: '/' },
]);

function normalizePathname(pathname: string): string {
  return pathname.replace(/\/+$/, '') || '/';
}

function isUnderEnPrefix(pathname: string): boolean {
  return pathname === EN_ROUTE_PREFIX || pathname.startsWith(`${EN_ROUTE_PREFIX}/`);
}

export function resolveRouteLocale(pathname: string): string {
  const normalized: string = normalizePathname(pathname);
  if (isUnderEnPrefix(normalized) || ENGLISH_ONLY_ROUTES.has(normalized)) {
    return EN_LOCALE;
  }
  return DEFAULT_LOCALE;
}

export function landingPathOf(pathname: string): string {
  return isUnderEnPrefix(normalizePathname(pathname)) ? EN_ROUTE_PREFIX : '/';
}

export function isLandingPath(pathname: string): boolean {
  const normalized: string = normalizePathname(pathname);
  return normalized === '/' || normalized === EN_ROUTE_PREFIX;
}
