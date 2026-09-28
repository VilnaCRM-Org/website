/**
 * Integration coverage for `useRouteI18n` (`src/hooks/use-route-i18n.ts`), the hook
 * `pages/_app.tsx` runs to render every route in the language its pathname resolves to.
 *
 * Drives the real i18next store rather than a mock: the clone the hook hands to
 * `I18nextProvider` must translate from the same resources as the global instance, and
 * the effect must bring `<html lang>`, `dir` and the global instance to the route's
 * language — including the guard that skips `changeLanguage` when nothing changed.
 *
 * Permission / auth — Not applicable: the language is a function of the route.
 * Loading / error — Not applicable: resources are bundled, so every step is synchronous.
 */
import { act, render, renderHook, screen } from '@testing-library/react';
import i18n from 'i18next';
import { useRouter } from 'next/router';
import React from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';

import { DEFAULT_LOCALE, EN_LOCALE } from '@/config/locales';
import { syncDocumentLanguage, syncGlobalLanguage, useRouteI18n } from '@/hooks/use-route-i18n';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

function mockPathname(pathname: string): void {
  (useRouter as jest.Mock).mockReturnValue({ pathname });
}

function Copy(): React.ReactElement {
  const { t } = useTranslation();

  return <p>{t('header.advantages')}</p>;
}

function RoutedCopy(): React.ReactElement {
  const { instance } = useRouteI18n();

  return (
    <I18nextProvider i18n={instance}>
      <Copy />
    </I18nextProvider>
  );
}

describe('integration: useRouteI18n', () => {
  const initialLanguage: string = i18n.language;

  afterEach(async () => {
    await act(async () => {
      await i18n.changeLanguage(initialLanguage);
    });
    document.documentElement.removeAttribute('lang');
    document.documentElement.removeAttribute('dir');
  });

  it('renders the tree under the provider in the route language', () => {
    mockPathname('/en');

    render(<RoutedCopy />);

    expect(screen.getByText(i18n.getFixedT(EN_LOCALE)('header.advantages'))).toBeInTheDocument();
    expect(document.documentElement).toHaveAttribute('lang', EN_LOCALE);
    expect(document.documentElement).toHaveAttribute('dir', 'ltr');
    expect(i18n.language).toBe(EN_LOCALE);
  });

  it('leaves the global instance alone when the route already matches it', () => {
    mockPathname('/');
    const changeLanguage: jest.SpyInstance = jest.spyOn(i18n, 'changeLanguage');

    const { result } = renderHook(() => useRouteI18n());

    expect(result.current.locale).toBe(DEFAULT_LOCALE);
    expect(changeLanguage).not.toHaveBeenCalled();
    changeLanguage.mockRestore();
  });

  it('exposes both syncs for callers outside React', () => {
    syncGlobalLanguage(EN_LOCALE);
    expect(i18n.language).toBe(EN_LOCALE);

    syncGlobalLanguage(EN_LOCALE);
    expect(i18n.language).toBe(EN_LOCALE);

    syncDocumentLanguage(DEFAULT_LOCALE, i18n);
    expect(document.documentElement).toHaveAttribute('lang', DEFAULT_LOCALE);
  });
});
