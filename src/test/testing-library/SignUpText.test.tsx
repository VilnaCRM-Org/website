import { render } from '@testing-library/react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import SignUpText from '../../features/landing/components/AuthSection/SignUpText/SignUpText';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const socialTitle: string = t('sign_up.main_heading');
const vilnaText: string = t('sign_up.vilna_text');
const socialsText: string = t('sign_up.socials_main_heading');

describe('SignUpText Component', () => {
  it('should display title', () => {
    const { getByText } = render(<SignUpText socialLinks={[]} />);
    expect(getByText(socialTitle)).toBeInTheDocument();
    expect(getByText(vilnaText)).toBeInTheDocument();
  });

  it('should display text', () => {
    const { getByText } = render(<SignUpText socialLinks={[]} />);
    expect(getByText(socialsText)).toBeInTheDocument();
  });

  it('should render without crashing', () => {
    render(<SignUpText socialLinks={[]} />);
  });
});
