import { render, RenderOptions, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import Layout from '@/components/Layout';


jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }): React.ReactElement => <div>{children}</div>,
}));

jest.mock('../../features/landing/components/Header', () => function Header(): React.ReactElement {
  return <header data-testid="header" />;
});

jest.mock('../../components/UiFooter', () => function Footer(): React.ReactElement {
  return <footer data-testid="footer" />;
});

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string): string => {
      const translations: { [key: string]: string } = {
        'VilnaCRM API': 'VilnaCRM API',
        'The first Ukrainian open source CRM': 'The first Ukrainian open source CRM'
      };
      return translations[key] || key;
    }
  })
}));

interface CustomRenderOptions extends RenderOptions {
  children?: React.ReactNode;
}

const metaAttributesSelector: string = 'meta[name="description"][content="The first Ukrainian open source CRM"]';
const logoName: string = 'VilnaCRM API';

const customRender: (ui: React.ReactElement, options?: CustomRenderOptions) => RenderResult = (
  ui: React.ReactElement,
  options?: CustomRenderOptions
): RenderResult => {
  function AllProviders({ children }: { children: React.ReactNode }): React.JSX.Element {
    return <div>{children}</div>;
  }

  return render(ui, { wrapper: AllProviders, ...options });
};


describe('Layout component', () => {
  const renderLayout: (children?: React.ReactNode) => RenderResult = (children?: React.ReactNode): RenderResult =>
    customRender(<Layout>{children || <div>Default content</div>}</Layout>);

  it('renders children content', () => {
    const testContent: string = 'Test child content';
    renderLayout(<div data-testid="test-child">{testContent}</div>);

    expect(screen.getByTestId('test-child')).toBeInTheDocument();
    expect(screen.getByText(testContent)).toBeInTheDocument();
  });

  it('renders header and footer', () => {
    renderLayout();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('sets correct page title', () => {
    renderLayout();

    const title: HTMLElement | null = document.querySelector('title');
    expect(title?.textContent).toBe('VilnaCRM API');
  });

  it('sets correct meta description', () => {
    renderLayout();

    const metaDescription: Element | null = document.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute(
      'content',
      'The first Ukrainian open source CRM'
    );
  });

  it('includes apple-touch-icon link', () => {
    renderLayout();

    const touchIcon: Element | null = document.querySelector('link[rel="apple-touch-icon"]');
    expect(touchIcon).toHaveAttribute('href', '../../assets/img/touch.png');
  });

  it('renders in correct order: header -> content -> footer', () => {
    const { container } = renderLayout(<main data-testid="main-content">Content</main>);

    const elements: string = container.innerHTML;
    const headerIndex: number = elements.indexOf('header');
    const contentIndex: number = elements.indexOf('main-content');
    const footerIndex: number = elements.indexOf('footer');

    expect(headerIndex).toBeLessThan(contentIndex);
    expect(contentIndex).toBeLessThan(footerIndex);
  });

  it('handles empty children gracefully', () => {
    renderLayout();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });

  it('renders title and metadata correctly', async () => {
    const { getByText, container } = renderLayout();

    const titleElement: HTMLElement = getByText(logoName);
    const metaElement: Element | null = container.querySelector(metaAttributesSelector);

    expect(titleElement).toHaveTextContent(logoName);
    expect(metaElement).toBeInTheDocument();
  });
});
