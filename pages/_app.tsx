import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider } from '@mui/material/styles';
import { GoogleAnalytics } from '@next/third-parties/google';
import * as Sentry from '@sentry/react';
import type { NextWebVitalsMetric } from 'next/app';
import dynamic from 'next/dynamic';
import React, { ComponentType, useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';

import { theme } from '@/components/app-theme';
import ErrorFallback from '@/components/error-fallback';
import Layout from '@/components/layout';
import { APP_ENVIRONMENT, APP_VERSION } from '@/config/app-version';
import { env } from '@/config/env';
import { golos } from '@/config/Fonts/golos';
import { RouteI18n, useRouteI18n } from '@/hooks/use-route-i18n';
import { initServiceWorker } from '@/lib/pwa/register-service-worker';
import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';
import { scrubEvent } from '@/lib/telemetry/scrub-event';
import { resolveTracesSampleRate } from '@/lib/telemetry/traces-sample-rate';
import { handleWebVitalsMetric } from '@/lib/web-vitals/report-web-vitals';

import 'swagger-ui-react/swagger-ui.css';

import '../styles/global.css';

import '../src/features/swagger/components/api-documentation/styles.scss';

import '../i18n';
import client from '../src/features/landing/api/graphql/apollo';

const DynamicHeader: ComponentType = dynamic(() => import('@/features/landing/components/header'), {
  ssr: false,
});

const renderErrorFallback: Sentry.FallbackRender = ({ resetError }) => (
  <ErrorFallback onRetry={resetError} />
);

const SKIP_TARGET_ID: string = 'skip-target';

const focusPageStart: NonNullable<Sentry.ErrorBoundaryProps['onReset']> = () => {
  document.getElementById(SKIP_TARGET_ID)?.focus();
};

const tagRenderCrash: NonNullable<Sentry.ErrorBoundaryProps['beforeCapture']> = scope => {
  scope.setTags({ feature: 'app', action: 'render-crash' });
};

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(env.NEXT_PUBLIC_SENTRY_DSN),
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true }),
  ],
  tracePropagationTargets: [env.NEXT_PUBLIC_DEVELOPMENT_API_URL, env.NEXT_PUBLIC_API_URL].filter(
    Boolean
  ),
  tracesSampleRate: resolveTracesSampleRate(
    env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE,
    APP_ENVIRONMENT
  ),
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  release: APP_VERSION,
  environment: APP_ENVIRONMENT,
  beforeSend: scrubEvent,
  beforeBreadcrumb: scrubBreadcrumb,
});

function MyApp({ Component }: { Component: React.ComponentType }): React.ReactElement {
  const { locale, instance }: RouteI18n = useRouteI18n();

  useEffect(() => {
    initServiceWorker();
  }, []);

  return (
    <I18nextProvider key={locale} i18n={instance}>
      <ThemeProvider theme={theme}>
        <ApolloProvider client={client}>
          <main className={golos.className}>
            <Layout header={<DynamicHeader />}>
              <Sentry.ErrorBoundary
                fallback={renderErrorFallback}
                beforeCapture={tagRenderCrash}
                onReset={focusPageStart}
              >
                <Component />
              </Sentry.ErrorBoundary>
            </Layout>
            {env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
              <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
            ) : null}
          </main>
        </ApolloProvider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  handleWebVitalsMetric(metric);
}

export default MyApp;
