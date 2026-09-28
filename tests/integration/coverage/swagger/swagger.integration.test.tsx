/**
 * Integration coverage for the top-level `Swagger` page component.
 *
 * Imported by its own path: the feature barrel deliberately exposes only the
 * lazy `SwaggerPage` boundary (see `swagger-page.integration.test.tsx`), so a
 * static re-export of `Swagger` never reaches a page's initial chunk. Renders
 * the real `Navigation` + `ApiDocumentation`
 * subtree; `useSwagger` is stubbed to the loading state so `ApiDocumentation`
 * renders null (the heavy `swagger-ui-react` bundle is also stubbed for safety),
 * and the mount effect that switches the language to English is exercised.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import Swagger from '../../../../src/features/swagger/components/swagger/swagger';
import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

jest.mock('../../../../src/features/swagger/hooks/useSwagger');

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: function SwaggerUI(): React.ReactElement {
    return <div>SwaggerUI rendered</div>;
  },
}));

const mockUseSwagger = jest.mocked(useSwagger);

describe('integration: Swagger page', () => {
  beforeEach(() => {
    mockUseSwagger.mockReturnValue({
      error: null,
      swaggerContent: null,
      loading: true,
      retry: jest.fn(),
    });
  });

  it('renders the back link within the page wrapper', () => {
    render(<Swagger />);

    expect(
      screen.getByRole('link', { name: t('navigation.navigate_to_home_page') })
    ).toHaveAttribute('href', '/');
  });
});
