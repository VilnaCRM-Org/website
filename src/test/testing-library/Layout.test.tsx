import { render, RenderOptions, RenderResult, screen } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';

import Layout from '@/components/Layout';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }): React.ReactElement => (
    <div>{children}</div>
  ),
}));

jest.mock(
  '../../features/landing/components/Header',
  () =>
    function Header(): React.ReactElement {
      return <header data-testid="header" />;
    }
);

jest.mock(
  '../../components/UiFooter',
  () =>
    function Footer(): React.ReactElement {
      return <footer data-testid="footer" />;
    }
);

jest.mock('react-i18next', () => ({
  useTranslation: (): { t: (key: string) => string } => ({
    t: (key: string): string => {
      const translations: { [key: string]: string } = {
        'VilnaCRM API': 'VilnaCRM API',
        'The first Ukrainian open source CRM': 'The first Ukrainian open source CRM',
      };
      return translations[key] || key;
    },
  }),
}));

interface CustomRenderOptions extends RenderOptions {
  children?: React.ReactNode;
}

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
  const renderLayout: (children?: React.ReactNode) => RenderResult = (
    children?: React.ReactNode
  ): RenderResult => customRender(<Layout>{children || <div>Default content</div>}</Layout>);

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
    expect(metaDescription).toHaveAttribute('content', 'The first Ukrainian open source CRM');
  });
  it('renders in correct order: header -> content -> footer', () => {
    renderLayout(<main data-testid="main-content">Content</main>);
    const header: HTMLElement = screen.getByTestId('header');
    const content: HTMLElement = screen.getByTestId('main-content');
    const footer: HTMLElement = screen.getByTestId('footer');

    expect(header.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(content.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
  it('handles empty children gracefully', () => {
    renderLayout();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();
  });
});
