import { render, RenderResult } from '@testing-library/react';
import { DynamicOptions, Loader } from 'next/dynamic';
import React from 'react';
import '@testing-library/jest-dom';

import { expectNoA11yViolations } from '@/test/a11y/expect-no-a11y-violations';

import Landing from '../../features/landing/components/landing/landing';

type PreloadableComponent = React.ComponentType<object> & {
  preload?: () => unknown;
  render?: { preload: () => unknown };
};

type DynamicMockModule = { boundaryOptions: Array<DynamicOptions<object> | undefined> };

jest.mock('next/dynamic', () => {
  const boundaryOptions: Array<DynamicOptions<object> | undefined> = [];

  return {
    __esModule: true,
    boundaryOptions,
    default: (
      loader: Loader<object>,
      options?: DynamicOptions<object>
    ): React.ComponentType<object> => {
      const dynamicModule: typeof import('next/dynamic') = jest.requireActual('next/dynamic');
      const requiredComponent: PreloadableComponent = dynamicModule.default(loader);
      if (requiredComponent.preload) {
        requiredComponent.preload();
      } else {
        requiredComponent.render?.preload();
      }
      boundaryOptions.push(options);
      return requiredComponent;
    },
  };
});

jest.mock('../../features/landing/components/background-images/background-images', () =>
  jest.fn(() => <div>BackgroundImages</div>)
);
jest.mock('../../features/landing/components/about-us/about-us', () =>
  jest.fn(() => <div>AboutUs</div>)
);
jest.mock('../../features/landing/components/why-us/why-us', () => jest.fn(() => <div>WhyUs</div>));
jest.mock('../../features/landing/components/for-who-section/for-who-section', () =>
  jest.fn(() => <div>ForWhoSection</div>)
);
jest.mock('../../features/landing/components/possibilities/possibilities', () =>
  jest.fn(() => <div>Possibilities</div>)
);
jest.mock('../../features/landing/components/auth-section/auth-section', () =>
  jest.fn(() => <div>AuthSection</div>)
);

const { boundaryOptions } = jest.requireMock<DynamicMockModule>('next/dynamic');

const boxElementClass: string = '.MuiBox-root';
const positionRelativeStyle: string = 'position: relative';
const groupedSections: string[] = [
  'BackgroundImages',
  'AboutUs',
  'WhyUs',
  'ForWhoSection',
  'Possibilities',
];

describe('Landing', () => {
  it('render all components', () => {
    const { getByText } = render(<Landing />);

    [...groupedSections, 'AuthSection'].forEach(name => {
      expect(getByText(name)).toBeInTheDocument();
    });
  });

  it('render container correctly', () => {
    const { container } = render(<Landing />);

    const mainContainer: HTMLElement | null = container.querySelector(boxElementClass);

    expect(mainContainer).toHaveStyle(positionRelativeStyle);
  });

  it('loads through exactly one client-only boundary with a loading placeholder', () => {
    expect(boundaryOptions).toHaveLength(1);
    expect(boundaryOptions[0]).toMatchObject({ ssr: false });
    expect(boundaryOptions[0]?.loading).toEqual(expect.any(Function));
  });

  it('holds the footer and its shadow below the fold with an empty placeholder', async () => {
    const renderPlaceholder = boundaryOptions[0]?.loading as () => React.ReactElement;
    const { container }: RenderResult = render(renderPlaceholder());
    const placeholder: Element | null = container.firstElementChild;

    expect(placeholder).toHaveStyle({ minHeight: '150vh' });
    expect(placeholder).toBeEmptyDOMElement();
    expect(placeholder?.getAttributeNames().filter(name => name !== 'class')).toEqual([]);
    await expectNoA11yViolations(container);
  });

  it('has no accessibility violations once the sections have mounted', async () => {
    const { container } = render(<Landing />);

    await expectNoA11yViolations(container);
  });

  it('mounts the five grouped sections in one relative box and the auth section after it', () => {
    const { container, getByText } = render(<Landing />);

    const relativeBox: HTMLElement | null = container.querySelector(boxElementClass);
    const authSection: HTMLElement = getByText('AuthSection');

    groupedSections.forEach(name => {
      expect(relativeBox).toContainElement(getByText(name));
    });
    expect(relativeBox).not.toContainElement(authSection);
    expect(relativeBox?.nextElementSibling).toBe(authSection);
  });

  it('keeps the grouped sections in document order', () => {
    const { getByText } = render(<Landing />);

    groupedSections.slice(1).forEach((name, index) => {
      const previous: HTMLElement = getByText(groupedSections[index]!);

      expect(previous.compareDocumentPosition(getByText(name))).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
  });
});
