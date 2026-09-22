/**
 * Integration coverage for `documentation`: `pages/en/docs/api.tsx`'s body,
 * rendered through the feature barrel.
 *
 * Invalid input / boundary — Not applicable: no props, no state.
 * Loading / error — Not applicable: renders synchronously, no async boundary.
 * Locale — asserts against the imported i18n bundle, not `t()` on both sides:
 * a missing key echoes back on both sides, so `t()`-vs-`t()` would still pass.
 */
import { render, screen } from '@testing-library/react';
import i18n from 'i18next';

import { ApiDocs } from '../../../../src/features/documentation';
import en from '../../../../src/features/documentation/i18n/en.json';
import uk from '../../../../src/features/documentation/i18n/uk.json';

const apiDocsCopy: typeof en.documentation.api_docs = (i18n.language === 'en' ? en : uk)
  .documentation.api_docs;

describe('integration: ApiDocs', () => {
  it('renders the localized heading and body', () => {
    render(<ApiDocs />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(apiDocsCopy.heading);
    expect(screen.getByText(apiDocsCopy.body)).toBeInTheDocument();
  });

  it('links to the interactive API reference with an accessible name', () => {
    render(<ApiDocs />);

    expect(screen.getByRole('link', { name: apiDocsCopy.swagger_link })).toHaveAttribute(
      'href',
      '/swagger'
    );
  });
});
