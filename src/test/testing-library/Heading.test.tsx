import { render } from '@testing-library/react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import Heading from '../../features/landing/components/WhyUs/Heading/Heading';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const subtitleText: RegExp = new RegExp(t('why_us.business_subtitle'));

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
