import { faker } from '@faker-js/faker';

import { t } from '../utils/initializeLocalization';
import { removeHtmlTags } from '../utils/removeHtmlTags';

import { ExpectationEmail, ExpectationsPassword, User } from './types';

export const placeholderInitials: string = t('sign_up.form.name_input.placeholder');
export const placeholderEmail: string = t('sign_up.form.email_input.placeholder');
export const placeholderPassword: string = t('sign_up.form.password_input.placeholder');
export const placeholderConfirmPassword: string = t(
  'sign_up.form.confirm_password_input.placeholder'
);
export const policyText: string = removeHtmlTags('sign_up.form.confidential_text.fullText');
export const signUpButton: string = t('sign_up.form.button_text');

export const requiredNameError: string = t('sign_up.form.name_input.required');

// The built bundle points its Apollo client at a different GraphQL host per
// environment (localhost in dev, the production API in the export), so match by
// path instead of the exact dev URL (#328): the glob drives `page.route` mocks,
// the fragment drives response-URL filters.
export const graphqlEndpoint: string = '**/graphql';
export const graphqlUrlFragment: string = '/graphql';
const firstName: string = faker.helpers.fromRegExp(/[A-Za-zА-Яа-яІіЇїЄєҐґ]{3,10}/);
const lastName: string = faker.helpers.fromRegExp(/[A-Za-zА-Яа-яІіЇїЄєҐґ]{3,10}/);

// The prefix pins one uppercase, one digit and one lowercase character so a
// random body can never miss a policy rule and make the suite flaky.
export const userData: User = {
  fullName: `${firstName} ${lastName}`,
  email: faker.internet.email(),
  password: faker.internet.password({ length: 16, prefix: 'Q9a' }),
};

export const mismatchedPassword: string = `${userData.password}-mismatch`;

// Each fixture violates exactly one rule and satisfies the other three, so the
// asserted message does not depend on the order of PASSWORD_RULES.
const textShortText: string = faker.internet.password({
  length: 7,
  pattern: /[a-z]/,
  prefix: 'A1',
});

const textNoNumbers: string = faker.internet.password({
  length: 10,
  pattern: /[a-z]/,
  prefix: 'Ab',
});
const textNoUppercaseLetter: string = faker.internet.password({
  length: 10,
  pattern: /[a-z]/,
  prefix: '1',
});
const textNoLowercaseLetter: string = faker.internet.password({
  length: 10,
  pattern: /[A-Z]/,
  prefix: '1',
});

const emailWithoutDot: string = 'test@test';
const InvalidEmail: string = 'test@test.';

const emailErrorKeys: { stepError: string; invalid: string } = {
  stepError: t('sign_up.form.email_input.email_format_error'),
  invalid: t('sign_up.form.email_input.invalid_message'),
};

const passwordErrorKeys: {
  length: string;
  numbers: string;
  uppercase: string;
  lowercase: string;
} = {
  length: t('sign_up.form.password_input.error_length'),
  numbers: t('sign_up.form.password_input.error_numbers'),
  uppercase: t('sign_up.form.password_input.error_uppercase'),
  lowercase: t('sign_up.form.password_input.error_lowercase'),
};

export const confirmPasswordMismatchError: string = t(
  'sign_up.form.confirm_password_input.error_mismatch'
);

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
  {
    errorText: passwordErrorKeys.lowercase,
    password: textNoLowercaseLetter,
  },
];
