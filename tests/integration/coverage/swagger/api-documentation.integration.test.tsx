/**
 * Integration coverage for `ApiDocumentation`.
 *
 * Imported through the feature barrel (`components/ApiDocumentation/index.ts`)
 * so the re-export is executed too. `swagger-ui-react` is replaced with a light
 * stub (the real bundle is heavy and unnecessary here) and `useSwagger` is
 * mocked to drive the three render branches: loading, failure with retry, and
 * content — plus the focus hand-off when a retry fails again (issue #339).
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import ApiDocumentation from '../../../../src/features/swagger/components/api-documentation';
import useSwagger from '../../../../src/features/swagger/hooks/useSwagger';

jest.mock('../../../../src/features/swagger/hooks/useSwagger');

jest.mock('swagger-ui-react', () => ({
  __esModule: true,
  default: function SwaggerUI(): React.ReactElement {
    return <div>SwaggerUI rendered</div>;
  },
}));

const mockUseSwagger = jest.mocked(useSwagger);

const loadingText: string = t('api_documentation.loading');
const loadedText: string = t('api_documentation.loaded');
const errorText: string = t('api_documentation.error.message');
const retryText: string = t('api_documentation.error.retry');

type HookState = ReturnType<typeof useSwagger>;

function hookState(overrides: Partial<HookState> = {}): HookState {
  return { error: null, swaggerContent: null, loading: true, retry: jest.fn(), ...overrides };
}

describe('integration: ApiDocumentation', () => {
  it('announces a localized loading status while the schema is fetched', () => {
    mockUseSwagger.mockReturnValue(hookState());

    render(<ApiDocumentation />);

    expect(screen.getByText(loadingText)).toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('renders a localized alert with a retry button when the fetch fails', () => {
    const retry: jest.Mock = jest.fn();
    mockUseSwagger.mockReturnValue(
      hookState({ error: new Error('Failed to fetch'), loading: false, retry })
    );

    render(<ApiDocumentation />);

    expect(screen.getByRole('alert')).toHaveTextContent(errorText);
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    const button: HTMLElement = screen.getByRole('button', { name: retryText });
    expect(button).toHaveAccessibleDescription(errorText);
    expect(button).not.toHaveFocus();

    fireEvent.click(button);

    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('moves focus to the retry button when a retry fails again', () => {
    const failed: HookState = hookState({
      error: new Error('Failed to fetch'),
      loading: false,
    });
    mockUseSwagger.mockReturnValue(failed);
    const { rerender } = render(<ApiDocumentation />);
    fireEvent.click(screen.getByRole('button', { name: retryText }));

    mockUseSwagger.mockReturnValue(hookState());
    rerender(<ApiDocumentation />);
    expect(screen.queryByRole('button', { name: retryText })).not.toBeInTheDocument();

    mockUseSwagger.mockReturnValue(failed);
    rerender(<ApiDocumentation />);

    expect(screen.getByRole('button', { name: retryText })).toHaveFocus();
  });

  it('renders SwaggerUI and announces completion once the schema is available', () => {
    mockUseSwagger.mockReturnValue(
      hookState({ swaggerContent: { openapi: '3.0.0' }, loading: false })
    );

    render(<ApiDocumentation />);

    expect(screen.getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(loadedText);
    expect(screen.queryByText(loadingText)).not.toBeInTheDocument();
  });
});
