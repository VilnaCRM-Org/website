/**
 * Integration coverage for the `not-found` feature: the body of the branded 404
 * document (`pages/404.tsx`, issue #339) rendered through the feature barrel so
 * the re-export chain executes, with the copy read from the feature's own i18n
 * bundle.
 *
 * Invalid input / boundary — Not applicable: the component takes no props and
 * reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async
 * boundary.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import { NotFound } from '../../../../src/features/not-found';

describe('integration: NotFound', () => {
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
});
