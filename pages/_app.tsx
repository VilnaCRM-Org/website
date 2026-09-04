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
import { initServiceWorker } from '@/lib/pwa/register-service-worker';
import { handleWebVitalsMetric } from '@/lib/web-vitals/report-web-vitals';

import 'swagger-ui-react/swagger-ui.css';

import '../styles/global.css';

import '../src/features/swagger/components/api-documentation/styles.scss';

import i18n from '../i18n';
import client from '../src/features/landing/api/graphql/apollo';

// The landing Header is the site-wide chrome. It is composed here at the Next.js
// routing root so the shared Layout (src/components) stays feature-agnostic and
// does not import from src/features (enforced by dependency-cruiser).
const DynamicHeader: ComponentType = dynamic(() => import('@/features/landing/components/header'), {
  ssr: false,
});

Sentry.init({
  dsn: env.NEXT_PUBLIC_SENTRY_DSN,
  // The only interactive surface on this site is the sign-up form, so an
  // unmasked session replay would record a password field keystroke by
  // keystroke. Masking is Sentry's default; pinning it here means an upstream
  // default change cannot silently start capturing credentials (#378 F3).
  sendDefaultPii: false,
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({ maskAllInputs: true, maskAllText: true, blockAllMedia: true }),
  ],
  // Drop empty origins so Sentry never receives '' (which substring-matches
  // every URL and would attach trace headers to all outbound requests).
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

  // Registered from the routing root so the offline shell covers every route. The module
  // owns the production gate and the deferral to `load`, so this stays a one-line call.
  useEffect(() => {
    initServiceWorker();
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <ApolloProvider client={client}>
        <main className="app-typeface">
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

// Next.js calls this named export for every web-vital it records; the forwarding
// gate (field-vital filter, production check, sampling) and PII-free payload live
// in the shared module so the routing root stays a thin wrapper.
export function reportWebVitals(metric: NextWebVitalsMetric): void {
  handleWebVitalsMetric(metric);
}

export default MyApp;
