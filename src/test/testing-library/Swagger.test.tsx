import { render, screen } from '@testing-library/react';

import Swagger from '../../features/swagger/components/swagger/swagger';

const documentationText: string = 'API Documentation Component';

jest.mock(
  '../../features/swagger/components/api-documentation/api-documentation',
  () =>
    function MockApiDocumentation(): React.ReactElement {
      return <p>API Documentation Component</p>;
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

const backLinkName: string = 'navigation.navigate_to_home_page';

describe('Swagger', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockChangeLanguage.mockImplementation(() => {});
  });

  it('renders the back link at once and the documentation behind its own lazy boundary', async () => {
    render(<Swagger />);

    expect(screen.getByRole('link', { name: backLinkName })).toHaveAttribute('href', '/');
    expect(screen.getByRole('status')).toHaveTextContent('api_documentation.loading');
    expect(screen.queryByText(documentationText)).not.toBeInTheDocument();

    expect(await screen.findByText(documentationText)).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('places the back link before the documentation inside one xl container', async () => {
    render(<Swagger />);

    const documentation: HTMLElement = await screen.findByText(documentationText);
    const link: HTMLElement = screen.getByRole('link', { name: backLinkName });
    const container: Element | null = link.closest('.MuiContainer-maxWidthXl');

    expect(container).not.toBeNull();
    expect(container).toContainElement(documentation);
    expect(link.compareDocumentPosition(documentation)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  // The route decides the language (`resolveRouteLocale('/swagger')`); a
  // `changeLanguage('en')` effect here once fought it and left the landing English.
  it('does not change the language itself', async () => {
    const { rerender } = render(<Swagger />);
    await screen.findByText(documentationText);
    rerender(<Swagger />);

    expect(mockChangeLanguage).not.toHaveBeenCalled();
  });
});
