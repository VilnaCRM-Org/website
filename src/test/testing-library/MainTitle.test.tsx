import { render } from '@testing-library/react';
import { t } from 'i18next';

import MainTitle from '../../features/landing/components/ForWhoSection/MainTitle/MainTitle';

const forWhoTitle: string = t('for_who.heading_main');
const forWhoText: string = t('for_who.text_main');
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

  it('renders the cta as a link without nested button semantics', () => {
    const { getByRole, queryByRole } = render(<MainTitle />);
    const ctaLink: HTMLElement = getByRole('link', { name: forWhoButton });

    expect(ctaLink).toBeInTheDocument();
    expect(ctaLink).toHaveAttribute('href', '#signUp');
    expect(queryByRole('button', { name: forWhoButton })).not.toBeInTheDocument();
  });
});
