import { render } from '@testing-library/react';
import React from 'react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import WhyUs from '../../features/landing/components/WhyUs';

const t: TranslationFunctionType = createTranslation('pages/i18n');

jest.mock('../../components/UiCardList/CardSwiper', () => jest.fn());

const WrapperId: string = '#Advantages';
const signUpLinkLabelText: string = t('why_us.aria_label');
const signUpButtonText: string = t('why_us.button_text');

describe('SocialMediaItem', () => {
  it('render WhyUs component correctly', () => {
    const { container, getByLabelText, getByText } = render(<WhyUs />);

    const wrapperElement: HTMLElement | null = container.querySelector(WrapperId);
    const signUpLink: HTMLElement = getByLabelText(signUpLinkLabelText);
    const signUpButton: HTMLElement = getByText(signUpButtonText);

    expect(signUpLink).toBeInTheDocument();
    expect(wrapperElement).toBeInTheDocument();
    expect(signUpButton).toBeInTheDocument();
  });
});
