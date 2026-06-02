import { render } from '@testing-library/react';
import { t } from 'i18next';

import WhyUs from '../../features/landing/components/WhyUs';

jest.mock('../../components/UiCardList/CardSwiper', () => jest.fn());

const WrapperId: string = '#Advantages';
const signUpButtonText: string = t('why_us.button_text');

describe('SocialMediaItem', () => {
  it('render WhyUs component correctly', () => {
    const { container, getByText, queryByRole } = render(<WhyUs />);

    const wrapperElement: HTMLElement | null = container.querySelector(WrapperId);
    const signUpLink: HTMLAnchorElement | null = getByText(signUpButtonText).closest('a');

    expect(signUpLink).toBeInTheDocument();
    expect(signUpLink).toHaveAttribute('href', '#signUp');
    expect(wrapperElement).toBeInTheDocument();
    expect(queryByRole('button', { name: signUpButtonText })).not.toBeInTheDocument();
  });
});
