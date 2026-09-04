import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';
import '@testing-library/jest-dom';

import Offline from '../../../pages/offline';

// `next/head` is a side-effect component that needs the Next head manager; without it the
// page's metadata would never reach the document and the `noindex` assertion below could
// not fail. Rendering the children inline lets React 19 hoist them into <head> instead.
function MockHead({ children }: { children: React.ReactNode }): React.ReactNode {
  return children;
}
jest.mock('next/head', () => ({
  __esModule: true,
  default: MockHead,
}));

describe('Offline page', () => {
  it('announces the failure as the page heading', () => {
    render(<Offline />);

    expect(screen.getByRole('heading', { level: 1, name: t('offline.heading') })).toBeVisible();
  });

  it('explains what failed and how it recovers', () => {
    render(<Offline />);

    expect(screen.getByText(t('offline.description'))).toBeVisible();
    expect(screen.getByText(t('offline.hint'))).toBeVisible();
  });

  it('offers a way back as a link, which needs no JavaScript to work', () => {
    // This document is served while the network is down, so the `_next` bundle never loads
    // and nothing hydrates. A control that depends on a click handler would be dead.
    render(<Offline />);

    expect(screen.getByRole('link', { name: t('offline.home_link') })).toHaveAttribute('href', '/');
  });

  it('keeps itself out of search results', () => {
    // The page is a network artefact, not content: indexing it would surface "you are
    // offline" as a real result for the site.
    render(<Offline />);

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute(
      'content',
      'noindex'
    );
  });
});
