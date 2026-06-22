/**
 * Integration coverage for the Landing page composition component.
 *
 * `Landing` wires together every landing section through `next/dynamic`
 * (with `ssr: false`). To exercise the real composition synchronously in
 * jsdom, `next/dynamic` is unwrapped to its actual loader and each heavy
 * child section is stubbed, mirroring the proven testing-library setup. This
 * proves the layout wrapper (relative Box + the two `xl` containers) and the
 * barrel re-export end-to-end.
 */
import { render } from '@testing-library/react';
import { DynamicOptions, Loader } from 'next/dynamic';
import React from 'react';

import Landing from '@components/Landing/Landing';

import { LandingComponent } from '../../../../src/features/landing';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: Array<React.ReactElement> }): React.JSX.Element => (
    <div>{children}</div>
  ),
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

jest.mock('../../../../src/features/landing/components/BackgroundImages/BackgroundImages', () =>
  jest.fn(() => <div data-testid="background-images">BackgroundImages</div>)
);
jest.mock('../../../../src/features/landing/components/AboutUs/AboutUs', () =>
  jest.fn(() => <div data-testid="about-us">AboutUs</div>)
);
jest.mock('../../../../src/features/landing/components/WhyUs/WhyUs', () =>
  jest.fn(() => <div data-testid="why-us">WhyUs</div>)
);
jest.mock('../../../../src/features/landing/components/ForWhoSection/ForWhoSection', () =>
  jest.fn(() => <div data-testid="for-who-section">ForWhoSection</div>)
);
jest.mock('../../../../src/features/landing/components/Possibilities/Possibilities', () =>
  jest.fn(() => <div data-testid="possibilities">Possibilities</div>)
);
jest.mock('../../../../src/features/landing/components/AuthSection/AuthSection', () =>
  jest.fn(() => <div data-testid="auth-section">AuthSection</div>)
);

describe('Landing integration', () => {
  it('re-exports the Landing component from the feature barrel', () => {
    expect(LandingComponent).toBe(Landing);
  });

  it('renders every dynamic section through the composition', () => {
    const { getByTestId } = render(<Landing />);

    expect(getByTestId('background-images')).toBeInTheDocument();
    expect(getByTestId('about-us')).toBeInTheDocument();
    expect(getByTestId('why-us')).toBeInTheDocument();
    expect(getByTestId('for-who-section')).toBeInTheDocument();
    expect(getByTestId('possibilities')).toBeInTheDocument();
    expect(getByTestId('auth-section')).toBeInTheDocument();
  });

  it('wraps the upper sections in a relative Box', () => {
    const { container } = render(<Landing />);

    const wrapper: HTMLElement | null = container.querySelector('.MuiBox-root');

    expect(wrapper).toHaveStyle('position: relative');
  });
});
