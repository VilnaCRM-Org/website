import FacebookDrawerIcon from '@/assets/svg/social-icons/facebook.svg';
import GitHubDrawerIcon from '@/assets/svg/social-icons/github.svg';
import InstagramDrawerIcon from '@/assets/svg/social-icons/instagram.svg';
import LinkedinDrawerIcon from '@/assets/svg/social-icons/linked-in.svg';
import { socialProfileLinks } from '@/config/social-links';
import { SocialMedia } from '@/types/social-media';

import { NavItemProps } from '../../types/header/navigation';

const sectionLinks: Omit<NavItemProps, 'type'>[] = [
  { id: 'advantages', title: 'header.advantages', link: '#Advantages' },
  { id: 'for-who', title: 'header.for_who', link: '#forWhoSection' },
  { id: 'integration', title: 'header.integration', link: '#Integration' },
  { id: 'contacts', title: 'header.contacts', link: '#Contacts' },
];

const navListFor = (type: NonNullable<NavItemProps['type']>): NavItemProps[] =>
  sectionLinks.map(item => ({ ...item, type }));

export const headerNavList: NavItemProps[] = navListFor('header');

export const drawerNavList: NavItemProps[] = navListFor('drawer');

export const socialMedia: SocialMedia[] = [
  {
    id: 'instagram-link',
    icon: InstagramDrawerIcon,
    alt: 'header.drawer.alt_social_images.instagram',
    ariaLabel: 'header.drawer.aria_labels_social_images.instagram',
    linkHref: socialProfileLinks.instagram,
    type: 'drawer',
  },
  {
    id: 'gitHub-link',
    icon: GitHubDrawerIcon,
    alt: 'header.drawer.alt_social_images.github',
    ariaLabel: 'header.drawer.aria_labels_social_images.github',
    linkHref: socialProfileLinks.github,
    type: 'drawer',
  },
  {
    id: 'facebook-link',
    icon: FacebookDrawerIcon,
    alt: 'header.drawer.alt_social_images.facebook',
    ariaLabel: 'header.drawer.aria_labels_social_images.facebook',
    linkHref: socialProfileLinks.facebook,
    type: 'drawer',
  },
  {
    id: 'linkedin-link',
    icon: LinkedinDrawerIcon,
    alt: 'header.drawer.alt_social_images.linkedin',
    ariaLabel: 'header.drawer.aria_labels_social_images.linkedin',
    linkHref: socialProfileLinks.linkedin,
    type: 'drawer',
  },
];
