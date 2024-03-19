import '../styles/globals.css';
import React, { useEffect } from 'react';
import * as Sentry from '@sentry/react';
import i18n from '../i18n';

Sentry.init({
  dsn: process.env.SENTRY_DSN_KEY,
  integrations: [
    new Sentry.BrowserTracing({
      tracePropagationTargets: [
        process.env.NEXT_PUBLIC_LOCALHOST,
        /^https:\/\/yourserver\.io\/api/,
      ],
    }),
    new Sentry.Replay(),
  ],
  tracesSampleRate: 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

function MyApp(Component) {
  useEffect(() => {
    document.documentElement.dir = i18n.dir();
  }, []);

  return <Component />;
}

export default MyApp;
