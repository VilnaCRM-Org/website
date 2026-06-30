# Testing Library Component Example

A self-contained client unit test (jsdom, `TEST_ENV=client`). The component is
inlined so the snippet is runnable; in the repo it would live in
`src/test/testing-library/`. Assertions go through role and visible text, and the
expected label comes from i18next — not a hardcoded English string.

```tsx
import { Button } from '@mui/material';
import { render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { I18nextProvider, initReactI18next, useTranslation } from 'react-i18next';

interface SubscribePanelProps {
  isPending: boolean;
  onSubscribe: () => void;
}

function SubscribePanel({ isPending, onSubscribe }: SubscribePanelProps) {
  const { t } = useTranslation();

  return (
    <section aria-labelledby="subscribe-title">
      <h2 id="subscribe-title">{t('subscribe.title')}</h2>
      <Button type="button" onClick={onSubscribe} disabled={isPending}>
        {t('subscribe.button')}
      </Button>
    </section>
  );
}

const i18n = i18next.createInstance();

beforeAll(() =>
  i18n.use(initReactI18next).init({
    lng: 'en',
    fallbackLng: 'en',
    resources: {
      en: {
        translation: {
          'subscribe.title': 'Stay in touch',
          'subscribe.button': 'Subscribe',
        },
      },
    },
    interpolation: { escapeValue: false },
    initImmediate: false,
  })
);

describe('SubscribePanel', () => {
  it('renders the translated action enabled when idle', () => {
    render(
      <I18nextProvider i18n={i18n}>
        <SubscribePanel isPending={false} onSubscribe={jest.fn()} />
      </I18nextProvider>
    );

    expect(screen.getByRole('button', { name: i18n.t('subscribe.button') })).toBeEnabled();
  });
});
```

## The real repo shortcut

Most specs do not build their own i18next instance: `jest.setup.ts` imports the
shared `./i18n`, so module-scope `t` from `i18next` already resolves. A typical
test reads the expected string once and queries by it:

```tsx
import { render } from '@testing-library/react';
import { t } from 'i18next';

import MainTitle from '@/features/landing/components/ForWhoSection/MainTitle/MainTitle';

const heading = t('for_who.heading_main');

it('renders the section heading', () => {
  const { getByText } = render(<MainTitle />);
  expect(getByText(heading)).toBeInTheDocument();
});
```

For components that read GraphQL, render through `renderWithProviders` (from
`src/test/testing-library/utils.tsx`) and pass `apolloMocks`, so Apollo resolves
from `MockedProvider` instead of the network.
