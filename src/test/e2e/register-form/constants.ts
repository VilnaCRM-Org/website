import { faker } from '@faker-js/faker';

import { t } from '../utils/initializeLocalization';
import { removeHtmlTags } from '../utils/removeHtmlTags';

import { ExpectationEmail, ExpectationsPassword, User } from './types';

export const placeholderInitials: string = t('sign_up.form.name_input.placeholder');
export const placeholderEmail: string = t('sign_up.form.email_input.placeholder');
export const placeholderPassword: string = t('sign_up.form.password_input.placeholder');
export const policyText: string = removeHtmlTags('sign_up.form.confidential_text.fullText');
export const signUpButton: string = t('sign_up.form.button_text');

export const fullNameFormatError: string = t('sign_up.form.name_input.error_text');

export const graphqlEndpoint: string = process.env.NEXT_PUBLIC_GRAPHQL_API_URL || 'http://localhost:4000/';

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

const emailErrorKeys: { stepError: string; invalid: string } = {
  stepError: t('sign_up.form.email_input.step_error_message'),
  invalid: t('sign_up.form.email_input.invalid_message'),
};

const passwordErrorKeys: { length: string; numbers: string; uppercase: string } = {
  length: t('sign_up.form.password_input.error_length'),
  numbers: t('sign_up.form.password_input.error_numbers'),
  uppercase: t('sign_up.form.password_input.error_uppercase'),
};

export const expectationsEmail: ExpectationEmail[] = [
  {
    errorText: emailErrorKeys.stepError,
    email: emailWithoutDot,
  },
  { errorText: emailErrorKeys.invalid, email: InvalidEmail },
];

export const expectationsPassword: ExpectationsPassword[] = [
  { errorText: passwordErrorKeys.length, password: textShortText },
  {
    errorText: passwordErrorKeys.numbers,
    password: textNoNumbers,
  },
  {
    errorText: passwordErrorKeys.uppercase,
    password: textNoUppercaseLetter,
  },
];
