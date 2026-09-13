/**
 * Integration coverage for the `documentation` feature: the placeholder body of
 * `pages/en/docs/api.tsx`, rendered through the feature barrel so the re-export
 * chain executes.
 *
 * Invalid input / boundary — Not applicable: the component takes no props and
 * reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async
 * boundary.
 * Locale — Not applicable: the stub carries the hardcoded English copy it shipped
 * with; localizing it belongs to the change that gives it real content.
 */
import { render, screen } from '@testing-library/react';

import { ApiDocs } from '../../../../src/features/documentation';

describe('integration: ApiDocs', () => {
  it('renders the placeholder heading and body', () => {
    render(<ApiDocs />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('API Documentation (EN)');
    expect(
      screen.getByText('This is the English version of the API documentation page.')
    ).toBeInTheDocument();
  });
});
