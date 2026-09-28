import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import { expectNoA11yViolations } from '@/test/a11y/expect-no-a11y-violations';

import ApiDocumentation from '../../features/swagger/components/api-documentation';
import Loading from '../../features/swagger/components/loading/loading';
import Navigation from '../../features/swagger/components/navigation/navigation';
import Swagger from '../../features/swagger/components/swagger/swagger';
import useSwagger from '../../features/swagger/hooks/useSwagger';

const backToTheHome: string = t('navigation.navigate_to_home_page');
const loadingText: string = t('api_documentation.loading');
const loadedText: string = t('api_documentation.loaded');
const errorText: string = t('api_documentation.error.message');
const retryText: string = t('api_documentation.error.retry');

describe('Swagger Navigation', () => {
  it('renders the back control as a link to the landing, named by its visible text', () => {
    const { container } = render(<Navigation />);

    const link: HTMLElement = screen.getByRole('link', { name: backToTheHome });
    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveTextContent(backToTheHome);
    // A landmark inside a link is invalid, and one link is not a navigation block.
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    // The arrow is decorative: a named icon would prefix the link's name.
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('is reachable and operable from the keyboard', async () => {
    render(<Navigation />);
    const user: UserEvent = userEvent.setup();

    await user.tab();

    expect(screen.getByRole('link', { name: backToTheHome })).toHaveFocus();
  });

  it('has no accessibility violations', async () => {
    const { container } = render(<Navigation />);

    await expectNoA11yViolations(container);
  });
});

jest.mock('../../features/swagger/hooks/useSwagger');

const mockSwaggerUi: { renders: boolean } = { renders: true };

jest.mock('swagger-ui-react', () => {
  function SwaggerUI(): React.ReactElement | null {
    return mockSwaggerUi.renders ? <div className="swagger-ui">SwaggerUI rendered</div> : null;
  }

  return { __esModule: true, default: SwaggerUI };
});

type HookState = ReturnType<typeof useSwagger>;

function hookState(overrides: Partial<HookState> = {}): HookState {
  return { error: null, swaggerContent: null, loading: true, retry: jest.fn(), ...overrides };
}

describe('Loading', () => {
  it('names the loading state through a status region, not an unnamed progressbar', async () => {
    const { container } = render(<Loading />);

    expect(screen.getByRole('status')).toHaveTextContent(loadingText);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('ApiDocumentation', () => {
  const mockUseSwagger: jest.MockedFunction<typeof useSwagger> = jest.mocked(useSwagger);

  beforeEach(() => {
    mockUseSwagger.mockReset();
  });

  it('shows the loading status while the schema is fetched', async () => {
    mockUseSwagger.mockReturnValue(hookState());

    const { container } = render(<ApiDocumentation />);

    expect(screen.getByText(loadingText)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByText(/SwaggerUI rendered/i)).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it('renders a localized alert and a retry button when the fetch fails', async () => {
    const retry: jest.Mock = jest.fn();
    mockUseSwagger.mockReturnValue(
      hookState({ error: new Error('Failed to fetch'), loading: false, retry })
    );

    const { container } = render(<ApiDocumentation />);

    expect(screen.getByRole('alert')).toHaveTextContent(errorText);
    // The raw error is not user copy and must never be echoed (#339).
    expect(screen.queryByText(/Failed to fetch/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Error loading API documentation/)).not.toBeInTheDocument();
    const retryButton: HTMLElement = screen.getByRole('button', { name: retryText });
    expect(retryButton).toHaveAccessibleDescription(errorText);
    expect(retryButton).not.toHaveFocus();

    fireEvent.click(retryButton);

    expect(retry).toHaveBeenCalledTimes(1);
    await expectNoA11yViolations(container);
  });

  it('focuses the retry button when a retry fails again, never on the first failure', () => {
    const failed: HookState = hookState({ error: new Error('Failed to fetch'), loading: false });
    mockUseSwagger.mockReturnValue(failed);
    const { rerender } = render(<ApiDocumentation />);
    expect(screen.getByRole('button', { name: retryText })).not.toHaveFocus();

    fireEvent.click(screen.getByRole('button', { name: retryText }));
    mockUseSwagger.mockReturnValue(hookState());
    rerender(<ApiDocumentation />);
    expect(screen.queryByRole('button', { name: retryText })).not.toBeInTheDocument();

    mockUseSwagger.mockReturnValue(failed);
    rerender(<ApiDocumentation />);

    expect(screen.getByRole('button', { name: retryText })).toHaveFocus();
  });

  it('renders SwaggerUI and announces completion when swaggerContent is available', async () => {
    mockUseSwagger.mockReturnValue(
      hookState({
        swaggerContent: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } },
        loading: false,
      })
    );

    const { container } = render(<ApiDocumentation />);

    expect(screen.getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(loadedText);
    expect(screen.queryByText(loadingText)).not.toBeInTheDocument();
    await expectNoA11yViolations(container);
  });
});

describe('Swagger layout stability (#493)', () => {
  const mockUseSwagger: jest.MockedFunction<typeof useSwagger> = jest.mocked(useSwagger);
  const loaded: HookState = hookState({
    swaggerContent: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } },
    loading: false,
  });

  beforeEach(() => {
    mockUseSwagger.mockReset();
    mockSwaggerUi.renders = true;
  });

  it('reserves a viewport in the loading status region and anchors the spinner to it', () => {
    render(<Loading />);

    expect(screen.getByRole('status')).toHaveStyle({ minHeight: '100vh', position: 'relative' });
  });

  it.each([
    ['loading', hookState()],
    ['failed', hookState({ error: new Error('Failed to fetch'), loading: false })],
  ])('keeps the viewport reserved while the documentation is %s', (_, state: HookState) => {
    mockUseSwagger.mockReturnValue(state);

    const { container } = render(<Swagger />);

    expect(container.firstElementChild).toHaveStyle({ minHeight: '100vh' });
  });

  it('keeps the viewport reserved while swagger-ui-react has mounted but renders nothing', () => {
    mockSwaggerUi.renders = false;
    mockUseSwagger.mockReturnValue(loaded);

    const { container } = render(<Swagger />);

    expect(screen.queryByText(loadingText)).not.toBeInTheDocument();
    expect(screen.queryByText(/SwaggerUI rendered/i)).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveStyle({ minHeight: '100vh' });
  });

  it('releases the reservation once Swagger UI has rendered, so the page keeps its height', () => {
    mockUseSwagger.mockReturnValue(loaded);

    const { container } = render(<Swagger />);

    expect(screen.getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
    expect(container.firstElementChild).not.toHaveStyle({ minHeight: '100vh' });
  });
});
