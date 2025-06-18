import FacebookDrawerIcon from '../../assets/svg/social-icons/facebook.svg';
import GitHubDrawerIcon from '../../assets/svg/social-icons/github.svg';
import InstagramDrawerIcon from '../../assets/svg/social-icons/instagram.svg';
import LinkedinDrawerIcon from '../../assets/svg/social-icons/linked-in.svg';
import { SocialMedia } from '../../types/social-media';

export const socialMedia: SocialMedia[] = [
  {
    id: 'instagram-link',
    icon: InstagramDrawerIcon,
    alt: 'header.drawer.alt_social_images.instagram',
    ariaLabel: 'header.drawer.aria_labels_social_images.instagram',
    linkHref: 'https://www.instagram.com/',
    type: 'drawer',
  },
  {
    id: 'github-link',
    icon: GitHubDrawerIcon,
    alt: 'header.drawer.alt_social_images.github',
    ariaLabel: 'header.drawer.aria_labels_social_images.github',
    linkHref: 'https://github.com/VilnaCRM-Org',
    type: 'drawer',
  },
  {
    id: 'facebook-link',
    icon: FacebookDrawerIcon,
    alt: 'header.drawer.alt_social_images.facebook',
    ariaLabel: 'header.drawer.aria_labels_social_images.facebook',
    linkHref: 'https://www.facebook.com/',
    type: 'drawer',
  },
  {
    id: 'linkedin-link',
    icon: LinkedinDrawerIcon,
    alt: 'header.drawer.alt_social_images.linkedin',
    ariaLabel: 'header.drawer.aria_labels_social_images.linkedin',
    linkHref: 'https://www.linkedin.com/',
    type: 'drawer',
  },
];
