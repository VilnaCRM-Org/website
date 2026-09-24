import * as Sentry from '@sentry/react';
import { render, RenderResult, screen, within } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { useRouter } from 'next/router';
import React from 'react';

import { resolveRouteLocale } from '@/config/locales';

import MyApp from '../../../pages/_app';
import en from '../../features/landing/i18n/en.json';
import uk from '../../features/landing/i18n/uk.json';

jest.mock('next/router', () => ({ useRouter: jest.fn() }));
jest.mock('next/dynamic', () => () => (): null => null);
jest.mock('../../lib/pwa/register-service-worker', () => ({ initServiceWorker: jest.fn() }));

const RECOVERED_TEXT = 'Recovered page content';
const UNRELATED_ALERT_BUTTON = 'Unrelated alert action';

let shouldThrow = true;

function CrashingPage(): React.ReactElement {
  if (shouldThrow) throw new Error('render crash');
  return <p>{RECOVERED_TEXT}</p>;
}

function CrashingPageWithRecoveredAlert(): React.ReactElement {
  if (shouldThrow) throw new Error('render crash');
  return (
    <div role="alert">
      <button type="button">{UNRELATED_ALERT_BUTTON}</button>
    </div>
  );
}

function errorBoundaryCopyFor(pathname: string): typeof en.error_boundary {
  return (resolveRouteLocale(pathname) === 'en' ? en : uk).error_boundary;
}

function renderApp(pathname: string, Component: React.ComponentType = CrashingPage): RenderResult {
  (useRouter as jest.Mock).mockReturnValue({ pathname });
  return render(<MyApp Component={Component} />);
}

/**
 * Permission / auth — Not applicable: the fallback is public and holds no auth state.
 * Loading — Not applicable: the crash and the reset are synchronous renders.
 */
describe('pages/_app error boundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    shouldThrow = true;
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('builds the SDK disabled when no DSN is configured, and still catches the crash', () => {
    renderApp('/en');

    expect(Sentry.getClient()?.getOptions().enabled).toBe(false);
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(RECOVERED_TEXT)).not.toBeInTheDocument();
  });

  it.each(['/', '/en'])(
    'shows the fallback in the route language of %s instead of a blank page',
    (pathname: string) => {
      const copy = errorBoundaryCopyFor(pathname);
      renderApp(pathname);

      const alert = within(screen.getByRole('alert'));
      expect(alert.getByRole('heading', { level: 1, name: copy.title })).toBeInTheDocument();
      expect(alert.getByText(copy.description)).toBeInTheDocument();
      expect(alert.getByRole('button', { name: copy.retry_button })).toBeInTheDocument();
      expect(alert.getByRole('link', { name: copy.home_link })).toHaveAttribute('href', '/');
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    }
  );

  it('keeps the page shell outside the boundary usable while the page is down', () => {
    renderApp('/en');

    expect(screen.getByRole('link', { name: en.header.layout.skip_to_content })).toBeVisible();
    expect(document.getElementById('skip-target')).toBeInTheDocument();
  });

  it('recovers the page from the keyboard once the crash is gone', async () => {
    const user: UserEvent = userEvent.setup();
    const copy = errorBoundaryCopyFor('/en');
    renderApp('/en');
    const retry = within(screen.getByRole('alert')).getByRole('button', {
      name: copy.retry_button,
    });

    await user.tab();
    await user.tab();
    expect(retry).toHaveFocus();

    shouldThrow = false;
    await user.keyboard('{Enter}');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText(RECOVERED_TEXT)).toBeInTheDocument();
    expect(document.getElementById('skip-target')).toHaveFocus();
  });

  it('ignores an unrelated alert the recovered page renders and focuses the skip target', async () => {
    const user: UserEvent = userEvent.setup();
    const copy = errorBoundaryCopyFor('/en');
    renderApp('/en', CrashingPageWithRecoveredAlert);
    const retry = within(screen.getByRole('alert')).getByRole('button', {
      name: copy.retry_button,
    });

    shouldThrow = false;
    await user.click(retry);

    const recoveredAlert = screen.getByRole('alert');
    expect(
      within(recoveredAlert).getByRole('button', { name: UNRELATED_ALERT_BUTTON })
    ).toBeInTheDocument();
    expect(document.getElementById('skip-target')).toHaveFocus();
  });

  it('shows the fallback again when the page still crashes on retry', async () => {
    const user: UserEvent = userEvent.setup();
    const copy = errorBoundaryCopyFor('/en');
    renderApp('/en');
    const retry = within(screen.getByRole('alert')).getByRole('button', {
      name: copy.retry_button,
    });

    await user.click(retry);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText(RECOVERED_TEXT)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: copy.retry_button })).toHaveFocus();
  });
});
