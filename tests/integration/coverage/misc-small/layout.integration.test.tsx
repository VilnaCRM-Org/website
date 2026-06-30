/**
 * Integration: Layout shell.
 *
 * `Layout` receives the header as a prop and loads UiFooter through
 * `next/dynamic` (ssr: false). To exercise the real composition synchronously
 * in jsdom, `next/dynamic` is unwrapped to its actual loader and the footer is
 * stubbed, mirroring the proven testing-library setup. This proves the i18n
 * page title / meta description and the header → children → footer order
 * end-to-end.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import { DynamicOptions, Loader } from 'next/dynamic';
import React from 'react';

import Layout from '@/components/layout';

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

jest.mock('next/dynamic', () => ({
  __esModule: true,
  default: (...props: never): never => {
    const dynamicModule: typeof import('next/dynamic') = jest.requireActual('next/dynamic');
    const dynamicActualComp: <P = object>(
      dynamicOptions: DynamicOptions<P> | Loader<P>,
      options?: DynamicOptions<P>
    ) => React.ComponentType<P> = dynamicModule.default;
    const RequiredComponent: React.ComponentType<object> = dynamicActualComp(props[0]);
    const requiredMock: (mock: never) => never = mock => mock;
    // @ts-expect-error no jest types
    const test: never = RequiredComponent.preload
      ? // @ts-expect-error no jest types
        RequiredComponent.preload()
      : // @ts-expect-error no jest types
        RequiredComponent.render.preload();
    requiredMock(test);
    // @ts-expect-error no jest types
    return RequiredComponent;
  },
}));

jest.mock(
  '../../../../src/components/ui-footer',
  () =>
    function Footer(): React.ReactElement {
      return <footer data-testid="footer" />;
    }
);

describe('Layout', () => {
  it('renders header, children and footer in order with i18n head metadata', async () => {
    render(
      <Layout header={<header data-testid="header" />}>
        <main data-testid="main-content">Content</main>
      </Layout>
    );

    const content: HTMLElement = screen.getByTestId('main-content');
    const header: HTMLElement = await screen.findByTestId('header');
    const footer: HTMLElement = await screen.findByTestId('footer');

    expect(header).toBeInTheDocument();
    expect(content).toBeInTheDocument();
    expect(footer).toBeInTheDocument();
    expect(header.compareDocumentPosition(content)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(content.compareDocumentPosition(footer)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await waitFor(() => {
      const title: HTMLElement | null = document.querySelector('title');
      expect(title?.textContent).toBe(t('header.layout.page_title'));
    });

    const meta: Element | null = document.querySelector('meta[name="description"]');
    expect(meta).toHaveAttribute('content', t('header.layout.meta_description'));
  });
});
