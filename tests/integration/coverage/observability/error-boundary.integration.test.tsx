/**
 * Integration: the render-crash boundary pages/_app.tsx composes.
 *
 * `pages/_app.tsx` cannot itself be imported (it boots Apollo, MUI, i18n and
 * the service worker at module load), so `sentry-app-observability.test.ts`
 * pins the wiring statically. This exercises the three pieces exactly as
 * `_app.tsx` composes them — the real `Sentry.ErrorBoundary`, the real
 * `ErrorFallback`, and a `beforeCapture` tagging callback with the app-level
 * tag shape — proving a child render crash is caught with exactly one
 * reported event, shown, and recoverable through the retry control.
 *
 * `Sentry.ErrorBoundary#componentDidCatch` calls `captureReactException`
 * itself, unconditionally, before it ever calls an `onError` prop (see
 * `node_modules/@sentry/react/build/cjs/errorboundary.js`), and that call
 * goes straight to `@sentry/browser`'s `captureException` — NOT the
 * `@sentry/react` named export a manual sink like the old `onError` handler
 * would have called. Mocking `@sentry/react` alone (as the previous version
 * of this spec did) is blind to the SDK's own automatic capture and cannot
 * prove the double-event defect is gone; mocking `@sentry/browser` instead
 * catches both paths through the one function `@sentry/react` re-exports by
 * reference at import time. `package.json` declares `@sentry/react` and
 * `@sentry/node`, but not `@sentry/browser` — it is only a transitive
 * dependency of `@sentry/react` — so this spec never imports it directly:
 * `@sentry/react`'s own CJS entry point re-exports every one of
 * `@sentry/browser`'s named exports onto itself by reference at require time
 * (`Object.keys(browser).forEach(k => exports[k] = browser[k])` in
 * `node_modules/@sentry/react/build/cjs/index.js`), so once `@sentry/browser`
 * is mocked, `Sentry.captureException` from the `@sentry/react` import below
 * IS the same mocked function `captureReactException` calls — no separate
 * import of the undeclared package is needed to observe it.
 * `Scope#captureException` (`@sentry/core`) also reads tags off `this`, not
 * off any argument the mocked function receives, so the tag assertion below
 * inspects the real `Scope` instance `beforeCapture` was given rather than
 * the mocked call's arguments.
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
    // React logs the caught error to console.error; silence it so the test
    // output stays readable without hiding an unrelated failure.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    captureException.mockClear();
  });

  it('reports the crash exactly once via the SDK own capture, tagged with the app-level shape', () => {
    renderBoundary();

    // Exactly one call is the regression gate for the double-event defect: an
    // onError-based sink would call this same mocked function a second time,
    // independently of the SDK's own automatic capture.
    expect(captureException).toHaveBeenCalledTimes(1);
    const [error] = captureException.mock.calls[0] as [unknown];
    expect(error).toBeInstanceOf(Error);

    // Tags never reach the mocked captureException as an argument — Scope#captureException
    // reads them off `this` — so assert directly on the real Scope beforeCapture received.
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
