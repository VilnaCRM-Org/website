/**
 * Integration coverage for the top-level `Swagger` page component.
 *
 * Imported by its own path: the feature barrel deliberately exposes only
 * `SwaggerPage`. `Swagger` renders the wrapper and the back link directly and
 * loads `ApiDocumentation` (which pulls in `swagger-ui-react`) behind its own
 * `next/dynamic` boundary, so the back link is present on the first render.
 * `useSwagger` is stubbed to the loading state and `swagger-ui-react` is stubbed
 * for safety.
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
