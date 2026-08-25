import { render } from '@testing-library/react';

import SocialMediaItem from '@/components/social-media/social-media-item/social-media-item';

import { testSocialDrawerItem, testSocialNoDrawerItem } from './fixtures/social-media.fixtures';

const widthStyle: string = 'width';
const heightStyle: string = 'height';
const imageRole: string = 'img';
const linkRole: string = 'link';

// The icon is decorative: the link already owns the accessible name through
// `aria-label`, so the image ships with an empty alt and `aria-hidden`. That
// takes it out of the accessibility tree entirely — it has no `img` role left to
// query by, hence the DOM lookup here (#382).
function getIcon(container: HTMLElement): HTMLImageElement {
  const icon: HTMLImageElement | null = container.querySelector('img');
  if (icon === null) throw new Error('social media icon not rendered');
  return icon;
}

describe('SocialMediaItem', () => {
  it('renders social media drawer icon with correct attributes', () => {
    const { getByRole, container } = render(<SocialMediaItem item={testSocialDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: testSocialDrawerItem.ariaLabel,
    });
    const imageElement: HTMLImageElement = getIcon(container);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialDrawerItem.linkHref);
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute(widthStyle, '24');
    expect(imageElement).toHaveAttribute(heightStyle, '24');
  });

  it('renders social media no drawer icon with correct attributes', () => {
    const { getByRole, container } = render(<SocialMediaItem item={testSocialNoDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: testSocialNoDrawerItem.ariaLabel,
    });
    const imageElement: HTMLImageElement = getIcon(container);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialNoDrawerItem.linkHref);
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute(widthStyle, '20');
    expect(imageElement).toHaveAttribute(heightStyle, '20');
  });

  it('opens the external profile in a new tab with the referrer withheld', () => {
    const { getByRole } = render(<SocialMediaItem item={testSocialDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: testSocialDrawerItem.ariaLabel,
    });

    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('leaves the control with exactly one accessible name', () => {
    const { queryAllByRole, container } = render(<SocialMediaItem item={testSocialDrawerItem} />);

    expect(queryAllByRole(imageRole)).toHaveLength(0);
    expect(getIcon(container)).toHaveAttribute('aria-hidden', 'true');
    expect(getIcon(container)).toHaveAttribute('alt', '');
  });
});
