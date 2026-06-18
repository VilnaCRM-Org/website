/**
 * Integration coverage for the top-level `Swagger` page component.
 *
 * Imported through the feature root barrel (`src/features/swagger/index.ts`) so
 * the re-export executes. Renders the real `Navigation` + `ApiDocumentation`
 * subtree; `useSwagger` is stubbed to the loading state so `ApiDocumentation`
 * renders null (the heavy `swagger-ui-react` bundle is also stubbed for safety),
 * and the mount effect that switches the language to English is exercised.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import { Swagger } from '../../../../src/features/swagger';
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
    mockUseSwagger.mockReturnValue({ error: null, swaggerContent: null });
  });

  it('renders the navigation within the page wrapper and switches language on mount', () => {
    render(<Swagger />);

    expect(screen.getByText(t('navigation.navigate_to_home_page'))).toBeInTheDocument();
    expect(screen.getByRole('navigation')).toBeInTheDocument();
  });
});
