/**
 * Integration coverage for `ApiDocumentation`.
 *
 * Imported through the feature barrel (`components/ApiDocumentation/index.ts`)
 * so the re-export is executed too. `swagger-ui-react` is replaced with a light
 * stub (the real bundle is heavy and unnecessary here) and `useSwagger` is
 * mocked to drive the three render branches: error, loading (null), and content.
 */
import { render, screen } from '@testing-library/react';
import React from 'react';

import ApiDocumentation from '../../../../src/features/swagger/components/ApiDocumentation';
import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

jest.mock('../../../../src/features/swagger/hooks/useSwagger');

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: function SwaggerUI(): React.ReactElement {
    return <div>SwaggerUI rendered</div>;
  },
}));

const mockUseSwagger = jest.mocked(useSwagger);

describe('integration: ApiDocumentation', () => {
  it('renders the error message when the hook reports an error', () => {
    mockUseSwagger.mockReturnValue({ error: new Error('Failed to fetch'), swaggerContent: null });

    render(<ApiDocumentation />);

    expect(screen.getByText(/Error loading API documentation/i)).toBeInTheDocument();
    expect(screen.getByText(/Failed to fetch/i)).toBeInTheDocument();
  });

  it('renders nothing while the schema is still loading', () => {
    mockUseSwagger.mockReturnValue({ error: null, swaggerContent: null });

    const { container } = render(<ApiDocumentation />);

    expect(container).toBeEmptyDOMElement();
  });

  it('renders SwaggerUI once the schema is available', () => {
    mockUseSwagger.mockReturnValue({
      error: null,
      swaggerContent: { openapi: '3.0.0' },
    });

    render(<ApiDocumentation />);

    expect(screen.getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
  });
});
