# Frontend Error Boundary Example

Catch render-time failures at the app boundary with `Sentry.ErrorBoundary` from
`@sentry/react`, not with scattered `try/catch` inside presentational
components. In `pages/_app.tsx` the boundary wraps the routed `Component` inside
the shared `Layout`.

```tsx
import * as Sentry from '@sentry/react';
import React from 'react';
import { useTranslation } from 'react-i18next';

function Fallback() {
  const { t } = useTranslation();
  return <p role="alert">{t('errors.unexpected')}</p>;
}

export function AppBoundary({ children }: { children: React.ReactNode }) {
  return (
    <Sentry.ErrorBoundary
      fallback={<Fallback />}
      beforeCapture={scope => {
        scope.setTag('surface', 'app');
      }}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}
```

- The fallback uses `useTranslation`, so the message is localized (`en`/`uk`) and
  announced via `role="alert"`.
- `beforeCapture` only sets a low-cardinality `surface` tag — no user data.
- Keep tokens, passwords, raw form values, and full API payloads out of the
  captured event (see [../reference/privacy-checklist.md](../reference/privacy-checklist.md)).
