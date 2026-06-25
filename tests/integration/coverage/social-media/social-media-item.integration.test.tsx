import { render } from '@testing-library/react';
import { t } from 'i18next';

import SocialMediaItem from '@/components/SocialMedia/SocialMediaItem/SocialMediaItem';
import {
  testSocialDrawerItem,
  testSocialNoDrawerItem,
} from '@/test/testing-library/fixtures/social-media.fixtures';

const widthStyle: string = 'width';
const heightStyle: string = 'height';
const imageRole: string = 'img';
const linkRole: string = 'link';

describe('SocialMediaItem (integration)', () => {
  it('renders a drawer-type icon at 24x24 with translated aria-label and alt', () => {
    const { getByRole } = render(<SocialMediaItem item={testSocialDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: t(testSocialDrawerItem.ariaLabel),
    });
    const imageElement: HTMLElement = getByRole(imageRole);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialDrawerItem.linkHref);
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute('alt', t(testSocialDrawerItem.alt));
    expect(imageElement).toHaveAttribute(widthStyle, '24');
    expect(imageElement).toHaveAttribute(heightStyle, '24');
  });

  it('renders a non-drawer-type icon at 20x20', () => {
    const { getByRole } = render(<SocialMediaItem item={testSocialNoDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: t(testSocialNoDrawerItem.ariaLabel),
    });
    const imageElement: HTMLElement = getByRole(imageRole);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialNoDrawerItem.linkHref);
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute(widthStyle, '20');
    expect(imageElement).toHaveAttribute(heightStyle, '20');
  });
});
