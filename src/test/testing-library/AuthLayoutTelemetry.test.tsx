import * as Sentry from '@sentry/react';
import { waitFor } from '@testing-library/react';

import { testInitials, testEmail, testPassword } from './constants';
import { mockInternalServerErrorResponse, renderAuthLayout } from './fixtures/auth-test-helpers';
import { fillForm } from './utils';

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
  setMeasurement: jest.fn(),
}));

const captureException: jest.Mock = Sentry.captureException as unknown as jest.Mock;

/**
 * Guards the wiring, not the sink: `reportHandledError` has its own unit test,
 * but nothing else proves the sign-up form still calls it when a submission
 * fails. Before #378 F3 the failure produced a toast and no telemetry at all,
 * so abuse of the only PII-collecting surface was invisible.
 */
describe('AuthLayout telemetry', () => {
  it('reports a failed submission with static tags and no credential data', async () => {
    renderAuthLayout([mockInternalServerErrorResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledTimes(1);
    });

    const [error, context] = captureException.mock.calls[0] as [
      unknown,
      { level: string; tags: Record<string, string> },
    ];

    expect(error).toBeDefined();
    expect(context.tags).toEqual({ feature: 'landing', action: 'signup' });

    const payload: string = JSON.stringify({ error, context });
    expect(payload).not.toContain(testPassword);
    expect(payload).not.toContain(testEmail);
  });

  it('sends nothing when the submission succeeds', async () => {
    renderAuthLayout([]);

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(captureException).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ tags: { feature: 'landing', action: 'signup' } })
      );
    });
  });
});
