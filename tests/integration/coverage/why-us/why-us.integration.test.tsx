/**
 * Integration coverage: WhyUs section.
 *
 * Renders the REAL `WhyUs` component (which transitively imports its
 * `Heading`, `constants` card list, `styles`, and both `index` barrels) using
 * the i18next instance initialized by `jest.setup.ts`, so localized strings
 * render. `CardSwiper` is mocked because it relies on the Swiper runtime that
 * is not the focus of this section's coverage.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import WhyUs from '@landing/why-us';

jest.mock('../../../../src/components/ui-card-list/card-swiper', () => jest.fn(() => null));

const wrapperId: string = '#Advantages';
const signUpButtonText: string = t('why_us.button_text');

describe('WhyUs integration', () => {
  it('renders the section wrapper with the advertised id', () => {
    const { container } = render(<WhyUs />);

    const wrapperElement: HTMLElement | null = container.querySelector(wrapperId);

    expect(wrapperElement).toBeInTheDocument();
    expect(wrapperElement?.tagName).toBe('SECTION');
  });

  it('renders the sign-up call-to-action as a link to the sign-up anchor', () => {
    render(<WhyUs />);

    const signUpLink: HTMLAnchorElement | null = screen.getByText(signUpButtonText).closest('a');

    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute('href', '#signUp');
  });

  it('renders the localized heading', () => {
    render(<WhyUs />);

    expect(screen.getByText(t('why_us.heading'))).toBeInTheDocument();
  });
});
