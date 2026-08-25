import { faker } from '@faker-js/faker';
import { t } from 'i18next';
import { AriaRole } from 'react';

import { CardItem } from '@/components/ui-card-list/types';
import { SocialMedia } from '@/types/social-media';

export const testId: string = faker.string.uuid();
export const testTitle: string = faker.lorem.word(6);
export const testText: string = faker.lorem.word(6);
export const testImg: string = faker.image.avatar();

const firstName: string = faker.helpers.fromRegExp(/[A-Za-zА-Яа-яІіЇїЄєҐґ]{3,10}/);
const lastName: string = faker.helpers.fromRegExp(/[A-Za-zА-Яа-яІіЇїЄєҐґ]{3,10}/);
export const testInitials: string = `${firstName} ${lastName}`;

export const testEmail: string = faker.internet.email();
// The prefix pins one uppercase, one digit and one lowercase character so a
// random body can never miss a policy rule and make the suite flaky.
export const testPassword: string = faker.internet.password({
  length: 16,
  prefix: 'Q9a',
});
export const testPlaceholder: string = faker.lorem.word(8);
export const testUrl: string = faker.internet.url();
export const mockEmail: string = 'info@vilnacrm.com';

// Form placeholders
export const fullNamePlaceholder: string = t('sign_up.form.name_input.placeholder');
export const emailPlaceholder: string = t('sign_up.form.email_input.placeholder');
export const passwordPlaceholder: string = t('sign_up.form.password_input.placeholder');
export const confirmPasswordPlaceholder: string = t(
  'sign_up.form.confirm_password_input.placeholder'
);
export const submitButtonText: string = t('sign_up.form.button_text');

// Form labels — the label/input association only became real when the input id
// started being forwarded (#382 F3), so these back the getByLabelText queries
// that guard it.
export const fullNameLabel: string = t('sign_up.form.name_input.label');
export const emailLabel: string = t('sign_up.form.email_input.label');
export const passwordLabel: string = t('sign_up.form.password_input.label');
export const confirmPasswordLabel: string = t('sign_up.form.confirm_password_input.label');

// ARIA roles
export const buttonRole: AriaRole = 'button';

export const typeOfCard: string = 'smallCard';

export const cardItem: CardItem = {
  id: testId,
  title: testTitle,
  text: testText,
  type: typeOfCard,
  alt: testText,
  imageSrc: testImg,
};
export const smallCard: CardItem = {
  id: testId,
  title: testTitle,
  text: testText,
  type: 'smallCard',
  alt: testText,
  imageSrc: testImg,
};
export const largeCard: CardItem = {
  id: testId,
  title: testTitle,
  text: testText,
  type: 'largeCard',
  alt: testText,
  imageSrc: testImg,
};

export const cardList: CardItem[] = [
  {
    id: testId,
    title: testTitle,
    text: testText,
    type: typeOfCard,
    alt: testText,
    imageSrc: testImg,
  },
];
export const smallCardList: CardItem[] = [
  {
    id: testId,
    title: testTitle,
    text: testText,
    type: 'smallCard',
    alt: testText,
    imageSrc: testImg,
  },
];
export const largeCardList: CardItem[] = [
  {
    id: testId,
    title: testTitle,
    text: testText,
    type: 'largeCard',
    alt: testText,
    imageSrc: testImg,
  },
];

export const mockedSocialLinks: SocialMedia[] = [
  {
    id: testId,
    icon: testImg,
    alt: testText,
    linkHref: 'https://www.instagram.com/',
    ariaLabel: testTitle,
  },
];
