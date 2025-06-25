import { render, RenderOptions, RenderResult, screen } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';
import '@testing-library/jest-dom';

import Layout from '@/components/Layout';

function MockHead({ children }: { children: React.ReactNode }): null {
  React.useEffect(() => {
    const created: HTMLElement[] = [];

    React.Children.forEach(children, child => {
      if (React.isValidElement(child)) {
        const el: HTMLElement = document.createElement(child.type as string);

        Object.entries(child.props ?? {}).forEach(([key, val]) => {
          if (key !== 'children' && typeof val === 'string') {
            el.setAttribute(key, val);
          }
        });

        if (typeof child.props?.children === 'string') {
          el.textContent = child.props.children;
        }

        document.head.appendChild(el);
        created.push(el);
      }
    });

    return () => created.forEach(el => el.remove());
  }, [children]);

  return null;
}
jest.mock('next/head', () => ({
  __esModule: true,
  default: MockHead,
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
    const titleText: string = t('header.layout.page_title');
    renderLayout();

    const title: HTMLElement | null = document.querySelector('title');
    expect(title?.textContent).toBe(titleText);
  });

  it('sets correct meta description', () => {
    const originalMeta: Element | null = document.querySelector('meta[name="description"]');
    const description: string = t('header.layout.meta_description');

    renderLayout();

    const metaDescription: Element | null = document.querySelector('meta[name="description"]');
    expect(metaDescription).toHaveAttribute('content', description);

    if (originalMeta) {
      document.head.appendChild(originalMeta);
    } else {
      document.querySelector('meta[name="description"]')?.remove();
    }
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
    expect(screen.getByText('Default content')).toBeInTheDocument();
  });
});
