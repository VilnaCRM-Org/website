import { render } from '@testing-library/react';
import '@testing-library/jest-dom';

import LandingSections from '../../features/landing/components/landing-sections';

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

const sectionOrder: string[] = [
  'BackgroundImages',
  'AboutUs',
  'WhyUs',
  'ForWhoSection',
  'Possibilities',
];
const xlContainerClass: string = 'MuiContainer-maxWidthXl';

function renderSections(): ReturnType<typeof render> & { relativeBox: HTMLElement } {
  const view: ReturnType<typeof render> = render(<LandingSections />);
  const relativeBox: HTMLElement = view.container.firstElementChild as HTMLElement;

  return { ...view, relativeBox };
}

describe('LandingSections', () => {
  it('renders the five sections as the children of one relative box, in order', () => {
    const { container, relativeBox } = renderSections();

    expect(container.childElementCount).toBe(2);
    expect(relativeBox).toHaveStyle('position: relative');
    expect(Array.from(relativeBox.children).map(child => child.textContent)).toEqual(sectionOrder);
  });

  it('wraps only why-us and possibilities in an xl container', () => {
    const { getByText } = renderSections();

    ['WhyUs', 'Possibilities'].forEach(name => {
      expect(getByText(name).parentElement).toHaveClass(xlContainerClass);
    });
    ['BackgroundImages', 'AboutUs', 'ForWhoSection'].forEach(name => {
      expect(getByText(name).parentElement).not.toHaveClass(xlContainerClass);
    });
  });

  it('adds no landmark, name or heading around the sections', () => {
    const { relativeBox, queryAllByRole } = renderSections();

    expect(relativeBox).not.toHaveAttribute('role');
    expect(relativeBox).not.toHaveAttribute('aria-label');
    expect(relativeBox).not.toHaveAttribute('id');
    expect(relativeBox).not.toHaveAttribute('tabindex');
    expect(queryAllByRole('region')).toHaveLength(0);
    expect(queryAllByRole('heading')).toHaveLength(0);
  });

  it('mounts the auth section in the same commit, right after the relative box', () => {
    const { getByText, relativeBox } = renderSections();
    const authSection: HTMLElement = getByText('AuthSection');

    expect(relativeBox).not.toContainElement(authSection);
    expect(relativeBox.nextElementSibling).toBe(authSection);
  });
});
