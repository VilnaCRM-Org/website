import { render } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import ApiDocumentation from '../../features/swagger/components/ApiDocumentation';
import Navigation from '../../features/swagger/components/Navigation/Navigation';
import useSwagger from '../../features/swagger/hooks/useSwagger';

const backToTheHome: string = t('navigation.navigate_to_home_page');
const arrowAlt: string = t('navigation.back_arrow_description');

describe('Swagger Navigation', () => {
  const originalLocation: Location = window.location;
  const mockAssign: jest.Mock = jest.fn();

  beforeAll(() => {
    Object.defineProperty(window, 'location', {
      value: {
        ...originalLocation,
        assign: mockAssign,
      },
      writable: true,
      configurable: true,
    });
  });

  afterAll(() => {
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    });
  });

  beforeEach(() => {
    mockAssign.mockClear();
  });
  it('renders text from translations', () => {
    const { getByText, getByAltText } = render(<Navigation />);

    expect(getByText(backToTheHome)).toBeInTheDocument();
    expect(getByAltText(arrowAlt)).toBeInTheDocument();
  });
  test('back button', async () => {
    const { getByText } = render(<Navigation />);
    const user: UserEvent = userEvent.setup();

    const backButton: HTMLElement = getByText(backToTheHome);

    await user.click(backButton);

    expect(window.location.assign).toHaveBeenCalledWith('/');
  });
});

jest.mock('../../features/swagger/hooks/useSwagger');

jest.mock('swagger-ui-react', () => {
  const SwaggerUI: React.FC = () => <div>SwaggerUI rendered</div>;
  return SwaggerUI;
});

describe('ApiDocumentation', () => {
  const mockUseSwagger: jest.Mock = jest.mocked(useSwagger);

  test('renders error message if error is present', () => {
    mockUseSwagger.mockReturnValue({
      error: new Error('Failed to fetch'),
      swaggerContent: null,
    });

    const { getByText } = render(<ApiDocumentation />);
    expect(getByText(/Error loading API documentation/i)).toBeInTheDocument();
    expect(getByText(/Failed to fetch/i)).toBeInTheDocument();
  });
  it('renders nothing while Swagger content is loading', () => {
    mockUseSwagger.mockReturnValue({
      error: null,
      swaggerContent: null,
    });

    const { container } = render(<ApiDocumentation />);

    expect(container).toBeEmptyDOMElement();
  });
  test('renders SwaggerUI when swaggerContent is available', () => {
    mockUseSwagger.mockReturnValue({
      error: null,
      swaggerContent: { openapi: '3.0.0', info: { title: 'Test API', version: '1.0.0' } },
    });

    const { getByText } = render(<ApiDocumentation />);
    expect(getByText(/SwaggerUI rendered/i)).toBeInTheDocument();
  });
});
