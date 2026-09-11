import * as Sentry from '@sentry/react';

export interface HandledErrorContext {
  feature: string;
  action: string;
}

export function reportHandledError(error: unknown, context: HandledErrorContext): void {
  Sentry.captureException(error, {
    level: 'error',
    tags: { feature: context.feature, action: context.action },
  });
}
