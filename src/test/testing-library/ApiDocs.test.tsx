import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import '@testing-library/jest-dom';

import ApiDocs from '../../features/documentation/components/api-docs/api-docs';

/**
 * The `/en/docs/api` documentation entry point (issue #339).
 *
 * The page orients an English-speaking reader and sends them to the interactive,
 * always-current reference at `/swagger` rather than restating API facts this page
 * cannot keep in sync. The assertions are on that orientation: the heading and body
 * render localized copy, and the link both points at `/swagger` and carries an
 * accessible name that states its own destination.
 *
 * Invalid input / boundary — Not applicable: the page takes no props and reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async boundary.
 */
describe('ApiDocs component', () => {
  it('explains itself as the localized page heading', () => {
    render(<ApiDocs />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      t('documentation.api_docs.heading')
    );
  });

  it('renders the orienting body copy', () => {
    render(<ApiDocs />);

    expect(screen.getByText(t('documentation.api_docs.body'))).toBeInTheDocument();
  });

  it('links to the interactive API reference with an accessible name', () => {
    render(<ApiDocs />);

    expect(
      screen.getByRole('link', { name: t('documentation.api_docs.swagger_link') })
    ).toHaveAttribute('href', '/swagger');
  });
});
