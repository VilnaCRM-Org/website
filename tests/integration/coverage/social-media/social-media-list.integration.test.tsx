import { render } from '@testing-library/react';

import { testSocialDrawerItem, testSocialNoDrawerItem } from '@landing/SocialMedia/constants';
import SocialMediaList from '@landing/SocialMedia/SocialMediaList/SocialMediaList';

import { SocialMedia } from '../../../../src/features/landing/types/social-media';

const imageRole: string = 'img';
const linkRole: string = 'link';

const emptySocialLinks: SocialMedia[] = [];
const socialLinks: SocialMedia[] = [testSocialDrawerItem, testSocialNoDrawerItem];

describe('SocialMediaList (integration)', () => {
  it('renders one social media item per link', () => {
    const { getAllByRole } = render(<SocialMediaList socialLinks={socialLinks} />);

    expect(getAllByRole(linkRole)).toHaveLength(socialLinks.length);
    expect(getAllByRole(imageRole)).toHaveLength(socialLinks.length);
  });

  it('renders no items when the socialLinks array is empty', () => {
    const { queryAllByRole } = render(<SocialMediaList socialLinks={emptySocialLinks} />);

    expect(queryAllByRole(linkRole)).toHaveLength(0);
  });
});
