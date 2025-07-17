import { faker } from '@faker-js/faker';

import FacebookDrawerIcon from '../../assets/svg/social-icons/facebook.svg';
import GitHubDrawerIcon from '../../assets/svg/social-icons/github.svg';
import InstagramDrawerIcon from '../../assets/svg/social-icons/instagram.svg';
import LinkedinDrawerIcon from '../../assets/svg/social-icons/linked-in.svg';
import { NavItemProps } from '../../types/header/navigation';
import { SocialMedia } from '../../types/social-media';

const navItems: Omit<NavItemProps, 'type'>[] = [
  { id: 'advantages', title: 'header.advantages', link: '#Advantages' },
  { id: 'for-who', title: 'header.for_who', link: '#forWhoSection' },
  { id: 'integration', title: 'header.integration', link: '#Integration' },
  { id: 'contacts', title: 'header.contacts', link: '#Contacts' },
];


export const headerNavList: NavItemProps[] = navItems.map(item => ({ ...item, type: 'header' }));
export const drawerNavList: NavItemProps[] = navItems.map(item => ({ ...item, type: 'drawer' }));


const baseSocialMedia: SocialMedia[] = [
  {
    id: 'instagram-link',
    icon: InstagramDrawerIcon,
    alt: 'header.drawer.alt_social_images.instagram',
    ariaLabel: 'header.drawer.aria_labels_social_images.instagram',
    linkHref: 'https://www.instagram.com/',
  },
  {
    id: 'gitHub-link',
    icon: GitHubDrawerIcon,
    alt: 'header.drawer.alt_social_images.github',
    ariaLabel: 'header.drawer.aria_labels_social_images.github',
    linkHref: ' https://github.com/VilnaCRM-Org',
  },
  {
    id: 'facebook-link',
    icon: FacebookDrawerIcon,
    alt: 'header.drawer.alt_social_images.facebook',
    ariaLabel: 'header.drawer.aria_labels_social_images.facebook',
    linkHref: 'https://www.facebook.com/',
  },
  {
    id: 'linkedin-link',
    icon: LinkedinDrawerIcon,
    alt: 'header.drawer.alt_social_images.linkedin',
    ariaLabel: 'header.drawer.aria_labels_social_images.linkedin',
    linkHref: 'https://www.linkedin.com/',
  },
];


export const socialMedia: SocialMedia[] = baseSocialMedia.map(item => ({ ...item, type: 'drawer' }));


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