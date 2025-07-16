import { render, screen } from '@testing-library/react';

import Swagger from '../../features/swagger/components/Swagger/Swagger';

jest.mock(
  '../../features/swagger/components/Navigation/Navigation',
  () =>
    function MockNavigation(): React.ReactElement {
      return <div data-testid="navigation">Navigation Component</div>;
    }
);

jest.mock(
  '../../features/swagger/components/ApiDocumentation/ApiDocumentation',
  () =>
    function MockApiDocumentation(): React.ReactElement {
      return <div data-testid="api-documentation">API Documentation Component</div>;
    }
);

const mockChangeLanguage: jest.Mock = jest.fn();

type UseTranslation = {
  t: (key: string) => string;
  i18n: {
    changeLanguage: jest.Mock;
    language: string;
  };
};

jest.mock('react-i18next', () => ({
  ...jest.requireActual('react-i18next'),
  useTranslation: (): UseTranslation => ({
    t: (key: string): string => key,
    i18n: {
      changeLanguage: mockChangeLanguage,
      language: 'en',
    },
  }),
}));

jest.mock('@mui/material', () => ({
  Box: ({ children, sx }: { children: React.ReactNode; sx: unknown }): React.ReactElement => (
    <div data-testid="mui-box" style={sx as React.CSSProperties}>
      {children}
    </div>
  ),
  Container: ({
    children,
    maxWidth,
  }: {
    children: React.ReactNode;
    maxWidth: string;
  }): React.ReactElement => (
    <div data-testid="mui-container" data-max-width={maxWidth}>
      {children}
    </div>
  ),
}));

jest.mock('../../features/swagger/components/Swagger/styles', () => ({
  wrapper: {
    padding: '20px',
    backgroundColor: '#f5f5f5',
  },
}));
const renderSwagger: () => ReturnType<typeof render> = (): ReturnType<typeof render> =>
  render(<Swagger />);

describe('Swagger Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangeLanguage.mockImplementation(() => {});
  });

  describe('Component Structure', () => {
    test('renders all main components', () => {
      renderSwagger();

      expect(screen.getByTestId('mui-box')).toBeInTheDocument();
      expect(screen.getByTestId('mui-container')).toBeInTheDocument();
      expect(screen.getByTestId('navigation')).toBeInTheDocument();
      expect(screen.getByTestId('api-documentation')).toBeInTheDocument();
    });

    test('applies correct Material-UI props', () => {
      renderSwagger();

      const container: HTMLElement = screen.getByTestId('mui-container');
      expect(container).toHaveAttribute('data-max-width', 'xl');
    });

    test('applies wrapper styles', () => {
      renderSwagger();

      const box: HTMLElement = screen.getByTestId('mui-box');
      expect(box).toHaveStyle({
        padding: '20px',
        backgroundColor: '#f5f5f5',
      });
    });
  });

  describe('Internationalization', () => {
    test('changes language to English on mount', () => {
      renderSwagger();

      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
      expect(mockChangeLanguage).toHaveBeenCalledTimes(1);
    });

    test('calls changeLanguage with correct dependency', () => {
      const { rerender } = renderSwagger();

      mockChangeLanguage.mockClear();

      rerender(<Swagger />);

      expect(mockChangeLanguage).toHaveBeenCalledWith('en');
    });
  });

  describe('Component Hierarchy', () => {
    test('renders components in correct order', () => {
      renderSwagger();

      const container: HTMLElement = screen.getByTestId('mui-container');
      const navigation: HTMLElement = screen.getByTestId('navigation');
      const apiDocumentation: HTMLElement = screen.getByTestId('api-documentation');

      expect(container.children[0]).toBe(navigation);
      expect(container.children[1]).toBe(apiDocumentation);
    });

    test('wraps components in proper Material-UI structure', () => {
      renderSwagger();

      const box: HTMLElement = screen.getByTestId('mui-box');
      const container: HTMLElement = screen.getByTestId('mui-container');

      expect(box).toContainElement(container);
      expect(container).toContainElement(screen.getByTestId('navigation'));
      expect(container).toContainElement(screen.getByTestId('api-documentation'));
    });
  });

  describe('Accessibility', () => {
    test('has proper semantic structure', () => {
      renderSwagger();

      expect(screen.getByTestId('mui-box')).toBeInTheDocument();
      expect(screen.getByTestId('mui-container')).toBeInTheDocument();
    });

    test('renders child components with proper test IDs', () => {
      renderSwagger();

      expect(screen.getByTestId('navigation')).toHaveTextContent('Navigation Component');
      expect(screen.getByTestId('api-documentation')).toHaveTextContent(
        'API Documentation Component'
      );
    });
  });

  describe('Performance', () => {
    test('does not re-render unnecessarily', () => {
      const { rerender } = renderSwagger();

      const initialRenderCount: number = mockChangeLanguage.mock.calls.length;

      rerender(<Swagger />);

      expect(mockChangeLanguage).toHaveBeenCalledTimes(initialRenderCount + 1);
    });
  });

  describe('Responsive Design', () => {
    test('applies responsive container props', () => {
      renderSwagger();

      const container: HTMLElement = screen.getByTestId('mui-container');
      expect(container).toHaveAttribute('data-max-width', 'xl');
    });

    test('wrapper styles are applied correctly', () => {
      renderSwagger();

      const box: HTMLElement = screen.getByTestId('mui-box');

      expect(box).toHaveStyle({
        padding: '20px',
        backgroundColor: '#f5f5f5',
      });
    });
  });
});
