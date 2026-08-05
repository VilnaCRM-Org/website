import * as Sentry from '@sentry/react';

import { reportHandledError } from '@/lib/telemetry/report-error';

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

const captureException: jest.Mock = Sentry.captureException as unknown as jest.Mock;

/**
 * Coverage for the handled-error sink added in #378 F3.
 *
 * The load-bearing assertions are (a) that a failure is reported at all — the
 * sign-up form previously swallowed every error — and (b) that nothing derived
 * from the submitted credentials travels with it.
 */
describe('reportHandledError', () => {
  it('forwards the error to Sentry tagged with the feature and action', () => {
    const error: Error = new Error('mutation failed');

    reportHandledError(error, { feature: 'landing', action: 'signup' });

    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException).toHaveBeenCalledWith(error, {
      level: 'error',
      tags: { feature: 'landing', action: 'signup' },
    });
  });

  it('reports non-Error rejection values unchanged', () => {
    reportHandledError('string rejection', { feature: 'landing', action: 'signup' });

    expect(captureException).toHaveBeenCalledWith('string rejection', expect.any(Object));
  });

  it('sends no user data alongside the exception', () => {
    reportHandledError(new Error('boom'), { feature: 'landing', action: 'signup' });

    // `clearMocks` resets the spy between tests, and this assertion pins that
    // so the call inspected below is unambiguously this test's.
    expect(captureException).toHaveBeenCalledTimes(1);
    const [, context] = captureException.mock.calls[0] as [unknown, Record<string, unknown>];

    expect(Object.keys(context).sort()).toEqual(['level', 'tags']);
    expect(context).not.toHaveProperty('user');
    expect(context).not.toHaveProperty('extra');
    expect(JSON.stringify(context)).not.toMatch(/password/i);
  });
});
