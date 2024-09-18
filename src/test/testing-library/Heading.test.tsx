import { render } from '@testing-library/react';
import { t } from 'i18next';

import Heading from '../../features/landing/components/WhyUs/Heading/Heading';

import { createLocalizedRegExp } from './utils';

const subtitleText: RegExp = createLocalizedRegExp('why_us.business_subtitle');

const headingText: string = t('why_us.heading');

describe('Heading component', () => {
  it('renders heading and subtitle correctly', () => {
    const { getByText } = render(<Heading />);
    expect(getByText(subtitleText)).toBeInTheDocument();
  });

  it('renders heading and text correctly', () => {
    const { getByText } = render(<Heading />);
    expect(getByText(headingText)).toBeInTheDocument();
  });
});
