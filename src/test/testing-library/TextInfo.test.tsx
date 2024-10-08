import { render } from '@testing-library/react';
import { t } from 'i18next';

import TextInfo from '../../features/landing/components/AboutUs/TextInfo/TextInfo';

import { createLocalizedRegExp } from './utils';

const aboutTitle: RegExp = createLocalizedRegExp('about_vilna.heading_first_main');
const aboutUsText: string = t('about_vilna.text_main');
const aboutUsButtonText: string = t('about_vilna.button_main');
const buttonSelector: string = 'a[href="#signUp"]';

describe('code snippet', () => {
  it('should display correct title from translation file', () => {
    const { getByText } = render(<TextInfo />);

    expect(getByText(aboutTitle)).toBeInTheDocument();
  });

  it('should display correct text from translation file', () => {
    const { getByText } = render(<TextInfo />);

    expect(getByText(aboutUsText)).toBeInTheDocument();
  });

  it('should display correct button from translation file', () => {
    const { getByRole } = render(<TextInfo />);

    const buttonElement: HTMLElement = getByRole('button', {
      name: aboutUsButtonText,
    });

    expect(buttonElement).toBeInTheDocument();
  });

  it('should display a link to sign up', () => {
    const { container } = render(<TextInfo />);

    expect(container.querySelector(buttonSelector)).toBeInTheDocument();
  });
});
