import { render } from '@testing-library/react';

import SocialMediaList from '@/components/SocialMedia/SocialMediaList/SocialMediaList';
import { SocialMedia } from '@/types/social-media';

import { testSocialDrawerItem } from './fixtures/social-media.fixtures';

jest.mock('../../components/SocialMedia/SocialMediaItem/SocialMediaItem', () =>
  jest.fn(() => <div data-testid="social-media-item" />)
);

const sociaLMediaTestId: string = 'social-media-item';
const emptySocialLinks: SocialMedia[] = [];
const socialLinks: SocialMedia[] = [testSocialDrawerItem];

describe('SocialMediaList', () => {
  it('renders social media items correctly', () => {
    const { getAllByTestId } = render(<SocialMediaList socialLinks={socialLinks} />);

    const socialMediaItems: HTMLElement[] = getAllByTestId(sociaLMediaTestId);
    expect(socialMediaItems.length).toBe(socialLinks.length);
  });

  it('renders no social media items when socialLinks array is empty', () => {
    const { queryByTestId } = render(<SocialMediaList socialLinks={emptySocialLinks} />);

    const socialMediaItems: HTMLElement | null = queryByTestId(sociaLMediaTestId);
    expect(socialMediaItems).not.toBeInTheDocument();
  });
});
