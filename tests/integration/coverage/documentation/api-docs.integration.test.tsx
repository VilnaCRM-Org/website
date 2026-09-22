/**
 * Integration coverage for the `documentation` feature: the localized body of
 * `pages/en/docs/api.tsx`, rendered through the feature barrel so the re-export
 * chain executes.
 *
 * Invalid input / boundary — Not applicable: the component takes no props and
 * reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async
 * boundary.
 * Locale — the component reads through `useTranslation()`/`t()` against the
 * committed i18n bundle, so this asserts the rendered copy against that bundle
 * rather than resolving `t()` on both sides of the assertion: i18next echoes a
 * missing key back as the key string on both sides, so a `t()`-vs-`t()` form
 * would keep passing even if the key were deleted from both bundles.
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
