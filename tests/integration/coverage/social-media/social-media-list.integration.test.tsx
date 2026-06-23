import { render } from '@testing-library/react';

import SocialMediaList from '@/components/SocialMedia/SocialMediaList/SocialMediaList';
import {
  testSocialDrawerItem,
  testSocialNoDrawerItem,
} from '@/test/testing-library/fixtures/social-media.fixtures';
import { SocialMedia } from '@/types/social-media';

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
