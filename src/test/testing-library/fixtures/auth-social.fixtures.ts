import { faker } from '@faker-js/faker';

import { SocialLink } from '../../../features/landing/types/authentication/social';

export const testSocialLink: SocialLink = {
  id: faker.string.uuid(),
  linkHref: faker.internet.url(),
  title: faker.lorem.sentence(),
  icon: faker.image.avatar(),
};
