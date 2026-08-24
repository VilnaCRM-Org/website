import { render } from '@testing-library/react';
import { t } from 'i18next';

import SocialMediaItem from '@/components/social-media/social-media-item/social-media-item';
import {
  testSocialDrawerItem,
  testSocialNoDrawerItem,
} from '@/test/testing-library/fixtures/social-media.fixtures';

const widthStyle: string = 'width';
const heightStyle: string = 'height';
const imageRole: string = 'img';
const linkRole: string = 'link';

// The link owns the accessible name via `aria-label`, so the icon ships
// decorative (`alt=""` + `aria-hidden`) and is no longer exposed with an `img`
// role — a second, differently-worded name on the same control confuses
// assistive tech (#382).
function getIcon(container: HTMLElement): HTMLImageElement {
  const icon: HTMLImageElement | null = container.querySelector('img');
  if (icon === null) throw new Error('social media icon not rendered');
  return icon;
}

describe('SocialMediaItem (integration)', () => {
  it('renders a drawer-type icon at 24x24 with a translated aria-label', () => {
    const { getByRole, container } = render(<SocialMediaItem item={testSocialDrawerItem} />);

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: t(testSocialDrawerItem.ariaLabel),
    });
    const imageElement: HTMLImageElement = getIcon(container);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialDrawerItem.linkHref);
    expect(linkElement).toHaveAttribute('target', '_blank');
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute('alt', '');
    expect(imageElement).toHaveAttribute('aria-hidden', 'true');
    expect(imageElement).toHaveAttribute(widthStyle, '24');
    expect(imageElement).toHaveAttribute(heightStyle, '24');
  });

  it('renders a non-drawer-type icon at 20x20', () => {
    const { getByRole, container, queryAllByRole } = render(
      <SocialMediaItem item={testSocialNoDrawerItem} />
    );

    const linkElement: HTMLElement = getByRole(linkRole, {
      name: t(testSocialNoDrawerItem.ariaLabel),
    });
    const imageElement: HTMLImageElement = getIcon(container);

    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', testSocialNoDrawerItem.linkHref);
    expect(linkElement).toHaveAttribute('rel', 'noopener noreferrer');
    expect(imageElement).toBeInTheDocument();
    expect(imageElement).toHaveAttribute(widthStyle, '20');
    expect(imageElement).toHaveAttribute(heightStyle, '20');
    expect(queryAllByRole(imageRole)).toHaveLength(0);
  });
});
