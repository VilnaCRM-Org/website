import { render } from '@testing-library/react';
import React from 'react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import MainTitle from '../../features/landing/components/ForWhoSection/MainTitle/MainTitle';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const forWhoTitle: string = t('for_who.heading_main');
const forWhoText: string = t('for_who.text_main');
const forWhoLabel: string = t('for_who.aria_label');
const forWhoButton: string = t('for_who.button_text');

describe('MainTitle component', () => {
  it('renders main title correctly', () => {
    const { getByText } = render(<MainTitle />);
    expect(getByText(forWhoTitle)).toBeInTheDocument();
  });

  it('renders main text correctly', () => {
    const { getByText } = render(<MainTitle />);
    expect(getByText(forWhoText)).toBeInTheDocument();
  });

  it('renders button correctly', () => {
    const { getByLabelText } = render(<MainTitle />);
    expect(getByLabelText(forWhoLabel)).toBeInTheDocument();
    expect(getByLabelText(forWhoLabel)).toHaveAttribute('href', '#signUp');
  });

  it('renders button correctly', () => {
    const { getByText } = render(<MainTitle />);
    expect(getByText(forWhoButton)).toBeInTheDocument();
  });
});
