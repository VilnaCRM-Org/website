import { render } from '@testing-library/react';
import { t } from 'i18next';

import TextInfo from '../../features/landing/components/AboutUs/TextInfo/TextInfo';

import { createLocalizedRegExp } from './utils';

const aboutTitle: RegExp = createLocalizedRegExp('about_vilna.heading_first_main');
const aboutUsText: string = t('about_vilna.text_main');
const aboutUsButtonText: string = t('about_vilna.button_main');

describe('code snippet', () => {
  it('should display correct title from translation file', () => {
    const { getByText } = render(<TextInfo />);

    expect(getByText(aboutTitle)).toBeInTheDocument();
  });

  it('should display correct text from translation file', () => {
    const { getByText } = render(<TextInfo />);

    expect(getByText(aboutUsText)).toBeInTheDocument();
  });

  it('renders the cta as a link without nested button semantics', () => {
    const { getByRole, queryByRole } = render(<TextInfo />);

    const ctaLink: HTMLElement = getByRole('link', {
      name: aboutUsButtonText,
    });

    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '#signUp');
    expect(queryByRole('button', { name: aboutUsButtonText })).not.toBeInTheDocument();
  });
});
