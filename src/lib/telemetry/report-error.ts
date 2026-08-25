import * as Sentry from '@sentry/react';

/**
 * Handled-error reporting for the browser bundle (#378 F3).
 *
 * The sign-up form is the only surface on this static site that accepts user
 * input, and until now a failed submission produced a toast and nothing else:
 * no exception, no counter, no log — `compiler.removeConsole` had already
 * stripped `console.*` from the production bundle. Credential stuffing or
 * enumeration probes against the live mutation were therefore invisible from
 * the application side.
 *
 * PII contract: only the exception and the two static tags below leave the
 * browser. Never pass form values, headers or anything derived from them —
 * `captureException` serialises whatever it is given.
 */
export interface HandledErrorContext {
  /** Product area, e.g. `landing`. Static string, never user-derived. */
  feature: string;
  /** What was being attempted, e.g. `signup`. Static string, never user-derived. */
  action: string;
}

export function reportHandledError(error: unknown, context: HandledErrorContext): void {
  Sentry.captureException(error, {
    level: 'error',
    tags: { feature: context.feature, action: context.action },
  });
}
