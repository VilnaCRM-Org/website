import { faker } from '@faker-js/faker';
import { t } from 'i18next';

import '../../../../i18n';

import { ExpectationEmail, ExpectationsPassword, User } from './types';

export const placeholderInitials: string = t('sign_up.form.name_input.placeholder');
export const placeholderEmail: string = t('sign_up.form.email_input.placeholder');
export const placeholderPassword: string = t('sign_up.form.password_input.placeholder');
export const policyText: string = t('sign_up.form.confidential_text.fullText')
  .replaceAll('<1>', '')
  .replaceAll('</1>', '');
export const signUpButton: string = t('sign_up.form.button_text');

export const fullNameFormatError: string = t('sign_up.form.name_input.error_text');

export const graphqlEndpoint: string = process.env.NEXT_PUBLIC_GRAPHQL_API_URL as string;

export const userData: User = {
  fullName: faker.person.fullName(),
  email: faker.internet.email(),
  password: faker.internet.password({ length: 16, prefix: 'Q9' }),
};

const textShortText: string = faker.internet.password({
  length: 7,
});

const textNoNumbers: string = faker.internet.password({
  length: 10,
  pattern: /[A-Z]/,
});
const textNoUppercaseLetter: string = faker.internet.password({
  length: 10,
  pattern: /[a-z]/,
  prefix: '1',
});

const emailWithoutDot: string = 'test@test';
const InvalidEmail: string = 'test@test.';

export const expectationsEmail: ExpectationEmail[] = [
  {
    errorText: t('sign_up.form.email_input.step_error_message'),
    email: emailWithoutDot,
  },
  { errorText: t('sign_up.form.email_input.invalid_message'), email: InvalidEmail },
];

export const expectationsPassword: ExpectationsPassword[] = [
  { errorText: t('sign_up.form.password_input.error_length'), password: textShortText },
  {
    errorText: t('sign_up.form.password_input.error_numbers'),
    password: textNoNumbers,
  },
  {
    errorText: t('sign_up.form.password_input.error_uppercase'),
    password: textNoUppercaseLetter,
  },
];

export const expectationsRequired: { text: string }[] = [
  { text: t('sign_up.form.name_input.required') },
];
