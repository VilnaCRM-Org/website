import { render } from '@testing-library/react';

import SocialList from '../../features/landing/components/AuthSection/SocialList/SocialList';
import { SocialLink } from '../../features/landing/types/authentication/social';

import { testSocialLink } from './fixtures/auth-social.fixtures';

const socialLinksTestId: string = 'social-item';
const emptySocialLinks: SocialLink[] = [];

const socialLinks: SocialLink[] = [testSocialLink];

jest.mock('../../features/landing/components/AuthSection/SocialItem/SocialItem', () =>
  jest.fn(() => <div data-testid="social-item" />)
);

describe('SocialList component', () => {
  it('renders a list of social links', () => {
    const { getAllByTestId } = render(<SocialList socialLinks={socialLinks} />);

    const socialItems: HTMLElement[] = getAllByTestId(socialLinksTestId);
    expect(socialItems.length).toBe(socialLinks.length);
  });

  it('renders no social links when socialLinks array is empty', () => {
    const { queryByTestId } = render(<SocialList socialLinks={emptySocialLinks} />);

    expect(queryByTestId(socialLinksTestId)).not.toBeInTheDocument();
  });
});
