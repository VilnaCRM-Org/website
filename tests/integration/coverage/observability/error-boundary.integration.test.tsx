/**
 * Renders the real `Sentry.ErrorBoundary` + `ErrorFallback` + `beforeCapture`
 * wiring `pages/_app.tsx` composes (that file can't be imported directly;
 * see `sentry-app-observability.test.ts` for the static pin).
 *
 * Mocks `@sentry/browser`, not `@sentry/react`: the SDK's own
 * `captureReactException` calls `@sentry/browser`'s `captureException`
 * directly, and `@sentry/react` re-exports it by reference, so mocking
 * `@sentry/react` alone would leave this capture unobserved.
 */
import * as Sentry from '@sentry/react';
import { fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import React from 'react';

import ErrorFallback from '@/components/error-fallback';

import en from '../../../../src/features/landing/i18n/en.json';
import uk from '../../../../src/features/landing/i18n/uk.json';

jest.mock('@sentry/browser', () => ({
  ...jest.requireActual('@sentry/browser'),
  captureException: jest.fn(),
}));

const captureException: jest.Mock = Sentry.captureException as unknown as jest.Mock;

const errorBoundaryCopy: typeof en.error_boundary = (i18n.language === 'en' ? en : uk)
  .error_boundary;

type BeforeCaptureScope = Parameters<NonNullable<Sentry.ErrorBoundaryProps['beforeCapture']>>[0];

const tagRenderCrash: NonNullable<Sentry.ErrorBoundaryProps['beforeCapture']> = scope => {
  scope.setTags({ feature: 'app', action: 'render-crash' });
};

let capturedScopes: BeforeCaptureScope[] = [];

const observeTagRenderCrash: NonNullable<Sentry.ErrorBoundaryProps['beforeCapture']> = (
  scope,
  error,
  componentStack
) => {
  tagRenderCrash(scope, error, componentStack);
  capturedScopes.push(scope);
};

let throwOnRender = true;

function Bomb(): React.ReactElement {
  if (throwOnRender) {
    throw new Error('render crash');
  }
  return <div>recovered content</div>;
}

function renderBoundary(): ReturnType<typeof render> {
  return render(
    <Sentry.ErrorBoundary
      fallback={({ resetError }): React.ReactElement => <ErrorFallback onRetry={resetError} />}
      beforeCapture={observeTagRenderCrash}
    >
      <Bomb />
    </Sentry.ErrorBoundary>
  );
}

describe('integration: error boundary wiring', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    throwOnRender = true;
    capturedScopes = [];
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    captureException.mockClear();
  });

  it('reports the crash exactly once via the SDK own capture, tagged with the app-level shape', () => {
    renderBoundary();

    // Exactly one call: an onError-based sink would call this mock a second
    // time, independently of the SDK's own automatic capture.
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error] = captureException.mock.calls[0] as [unknown];
    expect(error).toBeInstanceOf(Error);

    // Tags aren't an argument to captureException — Scope#captureException
    // reads them off `this` — so assert on the real Scope instead.
    expect(capturedScopes).toHaveLength(1);
    const [capturedScope] = capturedScopes as [BeforeCaptureScope];
    expect(capturedScope.getScopeData().tags).toEqual({
      feature: 'app',
      action: 'render-crash',
    });
  });

  it('shows the localized, accessible fallback in place of the crashed content', () => {
    renderBoundary();

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByText(errorBoundaryCopy.title)).toBeInTheDocument();
  });

  it('recovers the real page content when the retry control is activated', () => {
    renderBoundary();

    throwOnRender = false;
    fireEvent.click(screen.getByRole('button', { name: errorBoundaryCopy.retry_button }));

    expect(screen.getByText('recovered content')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
