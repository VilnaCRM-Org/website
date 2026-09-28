import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import '@testing-library/jest-dom';

import ApiDocs from '../../features/documentation/components/api-docs/api-docs';

/**
 * Invalid input / boundary — Not applicable: no props, no state.
 * Loading / error — Not applicable: renders synchronously, no async boundary.
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
