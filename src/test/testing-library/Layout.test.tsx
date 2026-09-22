import { render, RenderOptions, RenderResult, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import i18n, { t } from 'i18next';
import React from 'react';
import '@testing-library/jest-dom';

import Layout from '@/components/layout';

import en from '../../features/landing/i18n/en.json';
import uk from '../../features/landing/i18n/uk.json';

// The committed bundle is the reference, not the live i18next singleton the
// component itself reads from: i18next echoes a missing key back as the key
// string on both sides, so resolving t() here too would pass even if the key
// were deleted from both bundles.
const skipLinkLabel: string = (i18n.language === 'en' ? en : uk).header.layout.skip_to_content;

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

        const childContent = (child as React.ReactElement<{ children?: React.ReactNode }>).props
          ?.children;
        if (typeof childContent === 'string') {
          el.textContent = childContent;
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
  '../../components/ui-footer',
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
  ): RenderResult =>
    customRender(<Layout header={<header data-testid="header" />}>{children}</Layout>);

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
  it('renders a skip link before the header, with a matching focus target before the content', () => {
    renderLayout(<main data-testid="main-content">Content</main>);
    const skipLink: HTMLElement = screen.getByRole('link', { name: skipLinkLabel });
    const header: HTMLElement = screen.getByTestId('header');
    const content: HTMLElement = screen.getByTestId('main-content');

    expect(skipLink.compareDocumentPosition(header)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(skipLink).toHaveAttribute('href', '#skip-target');

    const target: HTMLElement | null = document.getElementById('skip-target');
    expect(target).toBeInTheDocument();
    expect(target).toHaveAttribute('tabindex', '-1');
    expect(target?.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
  it('makes the skip link the first tab stop in the document (a11y)', async () => {
    const user: UserEvent = userEvent.setup();
    renderLayout(<main data-testid="main-content">Content</main>);

    await user.tab();

    expect(screen.getByRole('link', { name: skipLinkLabel })).toHaveFocus();
  });
  it('handles empty children gracefully', () => {
    const { container } = renderLayout();

    expect(screen.getByTestId('header')).toBeInTheDocument();
    expect(screen.getByTestId('footer')).toBeInTheDocument();

    const textContent: string = container.textContent || '';
    expect(textContent).not.toContain('Default content');
  });
});
