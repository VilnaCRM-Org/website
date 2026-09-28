import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';
import '@testing-library/jest-dom';

import NotFound from '../../../pages/404';

/**
 * The branded 404 document (issue #339), exported to `out/404.html`.
 *
 * Next.js emitted its own unbranded English default until this page existed. The
 * assertions are on what a lost visitor can actually do — read what happened in their own
 * language, and get back to the site — plus the `noindex` that keeps a 404 body out of
 * search results.
 *
 * Invalid input / boundary — Not applicable: the page takes no props and reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async boundary.
 */
jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }): React.ReactNode => children,
}));

describe('404 page', () => {
  it('explains what happened, in the active locale', () => {
    render(<NotFound />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(t('not_found.heading'));
    expect(screen.getByText(t('not_found.hint'))).toBeInTheDocument();
  });

  it('offers a link back to the home page', () => {
    render(<NotFound />);

    expect(screen.getByRole('link', { name: t('not_found.home_link') })).toHaveAttribute(
      'href',
      '/'
    );
  });

  it('keeps itself out of search results', () => {
    render(<NotFound />);

    // An indexed 404 body is only ever a dead search result.
    expect(document.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
  });
});
