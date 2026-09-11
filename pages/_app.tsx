import { ApolloProvider } from '@apollo/client/react';
import { ThemeProvider } from '@mui/material/styles';
import { GoogleAnalytics } from '@next/third-parties/google';
import * as Sentry from '@sentry/react';
import type { NextWebVitalsMetric } from 'next/app';
import dynamic from 'next/dynamic';
import React, { ComponentType, useEffect } from 'react';

import { theme } from '@/components/app-theme';
import Layout from '@/components/layout';
import { env } from '@/config/env';
import { golos } from '@/config/Fonts/golos';
import { initServiceWorker } from '@/lib/pwa/register-service-worker';
import { handleWebVitalsMetric } from '@/lib/web-vitals/report-web-vitals';

import 'swagger-ui-react/swagger-ui.css';

import '../styles/global.css';

import '../src/features/swagger/components/api-documentation/styles.scss';

import i18n from '../i18n';
import client from '../src/features/landing/api/graphql/apollo';

const DynamicHeader: ComponentType = dynamic(() => import('@/features/landing/components/header'), {
  ssr: false,
});

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true }),
  ],
  tracePropagationTargets: [env.NEXT_PUBLIC_DEVELOPMENT_API_URL, env.NEXT_PUBLIC_API_URL].filter(
    Boolean
  ),
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

function MyApp({ Component }: { Component: React.ComponentType }): React.ReactElement {
  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, []);

  useEffect(() => {
    initServiceWorker();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <ApolloProvider client={client}>
        <main className={golos.className}>
          <Layout header={<DynamicHeader />}>
            <Component />
          </Layout>
          {env.NEXT_PUBLIC_GA_MEASUREMENT_ID ? (
            <GoogleAnalytics gaId={env.NEXT_PUBLIC_GA_MEASUREMENT_ID} />
          ) : null}
        </main>
      </ApolloProvider>
    </ThemeProvider>
  );
}

export function reportWebVitals(metric: NextWebVitalsMetric): void {
  handleWebVitalsMetric(metric);
}

export default MyApp;
