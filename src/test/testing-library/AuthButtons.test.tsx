import { render } from '@testing-library/react';

import { createTranslation, TranslationFunctionType } from '@/test/translate';

import AuthButtons from '../../features/landing/components/Header/AuthButtons/AuthButtons';

const t: TranslationFunctionType = createTranslation('pages/i18n');

const buttonLogInTestId: string = t('header.actions.log_in');
const buttonSignUpTestId: string = t('header.actions.try_it_out');

it('should render two buttons with correct text and styles', () => {
  const { getByText } = render(<AuthButtons />);

  const logInButton: HTMLElement = getByText(buttonLogInTestId);
  const signUpButton: HTMLElement = getByText(buttonSignUpTestId);

  expect(logInButton).toBeInTheDocument();
  expect(signUpButton).toBeInTheDocument();
});
