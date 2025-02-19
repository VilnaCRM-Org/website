import { faker } from '@faker-js/faker';
import { t } from 'i18next';
import { AriaRole } from 'react';

import { CardItem } from '@/components/UiCardList/types';

import { SocialMedia } from '../../features/landing/types/social-media';

export const testId: string = faker.string.uuid();
export const testTitle: string = faker.lorem.word(6);
export const testText: string = faker.lorem.word(6);
export const testImg: string = faker.image.avatar();
export const testInitials: string = faker.person.fullName();
export const testEmail: string = faker.internet.email();
export const testPassword: string = faker.internet.password({
  length: 16,
  prefix: 'Q9',
});
export const testPlaceholder: string = faker.lorem.word(8);
export const testUrl: string = faker.internet.url();
export const mockEmail: string = 'info@vilnacrm.com';

// Form placeholders
export const fullNamePlaceholder: string = t('sign_up.form.name_input.placeholder');
export const emailPlaceholder: string = t('sign_up.form.email_input.placeholder');
export const passwordPlaceholder: string = t('sign_up.form.password_input.placeholder');
export const submitButtonText: string = t('sign_up.form.button_text');

// ARIA roles
export const checkboxRole: AriaRole = 'checkbox';
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
