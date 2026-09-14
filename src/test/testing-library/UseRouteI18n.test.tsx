import { act, renderHook, RenderHookResult } from '@testing-library/react';
import i18n from 'i18next';
import { useRouter } from 'next/router';

import { DEFAULT_LOCALE, EN_LOCALE } from '@/config/locales';
import {
  RouteI18n,
  syncDocumentLanguage,
  syncGlobalLanguage,
  useRouteI18n,
} from '@/hooks/use-route-i18n';

/**
 * `useRouteI18n` is what makes `/en` English. It runs once at the routing root and
 * returns a route-language clone of the i18next instance for `I18nextProvider`, so the
 * exported HTML and the hydrating client tree already agree on the language — and in an
 * effect it syncs `<html lang>` / `dir` (React never reconciles the root element, so a
 * client-side navigation between locales would otherwise keep the previous page's
 * language, WCAG 3.1.1) and the global instance, for the callers that read `i18next`
 * directly (validators, the Apollo link).
 *
 * Invalid input — covered: an unknown pathname resolves to the default locale.
 * Loading / error — Not applicable: the resource store is already loaded, so cloning and
 * switching are synchronous.
 */
jest.mock('next/router', () => ({ useRouter: jest.fn() }));

function mockPathname(pathname: string): void {
  (useRouter as jest.Mock).mockReturnValue({ pathname });
}

function renderRouteI18n(pathname: string): RenderHookResult<RouteI18n, undefined> {
  mockPathname(pathname);
  return renderHook(() => useRouteI18n());
}

describe('useRouteI18n', () => {
  const initialLanguage: string = i18n.language;

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage(initialLanguage);
    });
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('hands out an English clone for /en that shares the loaded resources', () => {
    const { result } = renderRouteI18n('/en');

    expect(result.current.locale).toBe(EN_LOCALE);
    expect(result.current.instance).not.toBe(i18n);
    expect(result.current.instance.language).toBe(EN_LOCALE);
    expect(result.current.instance.t('header.advantages')).toBe(
      i18n.getFixedT(EN_LOCALE)('header.advantages')
    );
    expect(result.current.instance.t('header.advantages')).not.toBe(
      i18n.getFixedT(DEFAULT_LOCALE)('header.advantages')
    );
  });

  it('hands out the default-language clone for the root landing', () => {
    const { result } = renderRouteI18n('/');

    expect(result.current.locale).toBe(DEFAULT_LOCALE);
    expect(result.current.instance.language).toBe(DEFAULT_LOCALE);
  });

  it('resolves /swagger to English without a locale prefix', () => {
    const { result } = renderRouteI18n('/swagger');

    expect(result.current.locale).toBe(EN_LOCALE);
    expect(result.current.instance.language).toBe(EN_LOCALE);
  });

  it('syncs the document language and the global instance after mount', () => {
    expect(i18n.language).toBe(DEFAULT_LOCALE);

    renderRouteI18n('/en');

    expect(document.documentElement.lang).toBe(EN_LOCALE);
    expect(document.documentElement.dir).toBe('ltr');
    expect(i18n.language).toBe(EN_LOCALE);
  });

  it('keeps the same clone across re-renders of the same route', () => {
    const { result, rerender } = renderRouteI18n('/en');
    const first: RouteI18n['instance'] = result.current.instance;

    rerender();

    expect(result.current.instance).toBe(first);
  });

  it('switches the clone, the document and the global instance when the locale changes', () => {
    const { result, rerender } = renderRouteI18n('/en');
    const englishClone: RouteI18n['instance'] = result.current.instance;

    mockPathname('/');
    rerender();

    expect(result.current.locale).toBe(DEFAULT_LOCALE);
    expect(result.current.instance).not.toBe(englishClone);
    expect(result.current.instance.language).toBe(DEFAULT_LOCALE);
    expect(document.documentElement.lang).toBe(DEFAULT_LOCALE);
    expect(i18n.language).toBe(DEFAULT_LOCALE);
  });
});

describe('syncGlobalLanguage', () => {
  const initialLanguage: string = i18n.language;
  let changeLanguage: jest.SpyInstance;

  beforeEach(() => {
    changeLanguage = jest.spyOn(i18n, 'changeLanguage');
  });

  afterEach(async () => {
    changeLanguage.mockRestore();
    await i18n.changeLanguage(initialLanguage);
  });

  it('is a no-op when the global instance already speaks the route language', () => {
    syncGlobalLanguage(i18n.language);

    expect(changeLanguage).not.toHaveBeenCalled();
  });

  it('switches the global instance when it does not', () => {
    syncGlobalLanguage(EN_LOCALE);

    expect(changeLanguage).toHaveBeenCalledWith(EN_LOCALE);
    expect(i18n.language).toBe(EN_LOCALE);
  });
});

describe('syncDocumentLanguage', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('writes the locale and its direction onto the root element', () => {
    syncDocumentLanguage(EN_LOCALE, i18n.cloneInstance({ lng: EN_LOCALE }));

    expect(document.documentElement).toHaveAttribute('lang', EN_LOCALE);
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
  });

  it('asks the instance for the direction of the locale it is given, not its own', () => {
    const instance = i18n.cloneInstance({ lng: EN_LOCALE });
    const dir: jest.SpyInstance = jest.spyOn(instance, 'dir').mockReturnValue('rtl');

    syncDocumentLanguage('ar', instance);

    expect(dir).toHaveBeenCalledWith('ar');
    expect(document.documentElement).toHaveAttribute('dir', 'rtl');
    dir.mockRestore();
  });
});
