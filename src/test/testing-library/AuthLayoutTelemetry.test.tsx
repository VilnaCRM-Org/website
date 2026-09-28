import * as Sentry from '@sentry/react';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';

import { testInitials, testEmail, testPassword } from './constants';
import {
  fulfilledMockResponse,
  mockInternalServerErrorResponse,
  renderAuthLayout,
} from './fixtures/auth-test-helpers';
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

  it('reports a tripped honeypot with a static tag and no submitted value', async () => {
    const { container } = renderAuthLayout([]);
    const honeypot: HTMLInputElement | null = container.querySelector('input[name="Referral"]');
    const tripValue: string = 'https://spam.example';
    fireEvent.change(honeypot!, { target: { value: tripValue } });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => {
      expect(captureException).toHaveBeenCalledTimes(1);
    });

    const [error, context] = captureException.mock.calls[0] as [
      unknown,
      { level: string; tags: Record<string, string> },
    ];

    expect(context.tags).toEqual({ feature: 'landing', action: 'signup-honeypot' });
    const payload: string = JSON.stringify({ error: String(error), context });
    expect(payload).not.toContain(tripValue);
    expect(payload).not.toContain(testEmail);
    expect(payload).not.toContain(testPassword);
  });

  it('reports a honeypot submitted twice in a row only once', async () => {
    const { container, getByRole } = renderAuthLayout([]);
    const honeypot: HTMLInputElement | null = container.querySelector('input[name="Referral"]');
    fireEvent.change(honeypot!, { target: { value: 'https://spam.example' } });

    fillForm(testInitials, testEmail, testPassword, true);
    fireEvent.click(getByRole('button', { name: t('sign_up.form.button_text') }));

    await waitFor(() => {
      expect(screen.getByText(t('notifications.success.title'))).toBeVisible();
    });
    await waitFor(() =>
      expect(screen.getByPlaceholderText(t('sign_up.form.email_input.placeholder'))).toHaveValue('')
    );
    expect(captureException).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when the submission succeeds', async () => {
    renderAuthLayout([fulfilledMockResponse]);

    fillForm(testInitials, testEmail, testPassword, true);

    // Wait for the success notification first: asserting only the absence of
    // telemetry would pass at t=0, before the mutation had a chance to settle,
    // and would keep passing even if validation had blocked the submit.
    await waitFor(() => {
      expect(screen.getByText(t('notifications.success.title'))).toBeVisible();
    });

    expect(captureException).not.toHaveBeenCalled();
  });
});
