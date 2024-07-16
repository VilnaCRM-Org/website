import { render } from '@testing-library/react';
import { t } from 'i18next';

import PasswordTip from '../../features/landing/components/AuthSection/PasswordTip/PasswordTip';

const recommendationText: string = t('sign_up.form.password_tip.recommendation_text');
const firstOptionText: string = t('sign_up.form.password_tip.options.option_1');
const secondOptionText: string = t('sign_up.form.password_tip.options.option_2');
const thirdOptionText: string = t('sign_up.form.password_tip.options.option_3');

describe('PasswordTip component', () => {
  it('renders recommendation text', () => {
    const { getByText } = render(<PasswordTip />);
    expect(getByText(recommendationText)).toBeInTheDocument();
  });

  it('renders three password tip options', () => {
    const { getByText } = render(<PasswordTip />);
    expect(getByText(firstOptionText)).toBeInTheDocument();
    expect(getByText(secondOptionText)).toBeInTheDocument();
    expect(getByText(thirdOptionText)).toBeInTheDocument();
  });
});
