/**
 * Integration coverage: WhyUs `Heading`.
 *
 * Exercises both the default export (via the component) and the named export
 * exposed by the `Heading/index.ts` barrel, plus the `Heading/styles.ts`
 * applied during render. Localized heading and subtitle copy is asserted using
 * the i18next instance from `jest.setup.ts`.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import { Heading } from '@landing/why-us/heading';
import HeadingDefault from '@landing/why-us/heading/heading';

const headingText: string = t('why_us.heading');
const businessSubtitle: RegExp = new RegExp(t('why_us.business_subtitle'));

describe('WhyUs Heading integration', () => {
  it('renders the localized heading text', () => {
    render(<Heading />);

    expect(screen.getByText(headingText)).toBeInTheDocument();
  });

  it('renders the localized business subtitle copy', () => {
    render(<Heading />);

    expect(screen.getByText(businessSubtitle)).toBeInTheDocument();
  });

  it('exposes the same component through the default and barrel exports', () => {
    expect(Heading).toBe(HeadingDefault);
  });
});
