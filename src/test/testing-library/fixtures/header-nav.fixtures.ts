import { faker } from '@faker-js/faker';

import { NavItemProps } from '../../../features/landing/types/header/navigation';

export const testDrawerItem: NavItemProps = {
  id: faker.string.uuid(),
  title: faker.lorem.words(),
  link: faker.internet.url(),
  type: 'drawer',
};

export const testHeaderItem: NavItemProps = {
  id: faker.string.uuid(),
  title: faker.lorem.words(),
  link: faker.internet.url(),
  type: 'header',
};
