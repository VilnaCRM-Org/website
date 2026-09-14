import i18n, { i18n as I18nInstance } from 'i18next';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';

import { resolveRouteLocale } from '@/config/locales';

export interface RouteI18n {
  readonly locale: string;
  readonly instance: I18nInstance;
}

export function syncGlobalLanguage(locale: string): void {
  if (i18n.language !== locale) {
    i18n.changeLanguage(locale);
  }
}

export function syncDocumentLanguage(locale: string, instance: I18nInstance): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = instance.dir(locale);
}

export function useRouteI18n(): RouteI18n {
  const { pathname } = useRouter();
  const locale: string = resolveRouteLocale(pathname);
  const instance: I18nInstance = useMemo(() => i18n.cloneInstance({ lng: locale }), [locale]);

  useEffect(() => {
    syncDocumentLanguage(locale, instance);
    syncGlobalLanguage(locale);
  }, [instance, locale]);

  return { locale, instance };
}
