import {
  drawerNavList,
  headerNavList,
  socialMedia,
} from '../../features/landing/components/header/constants';
import { NavItemProps } from '../../features/landing/types/header/navigation';

const sectionLinks: Omit<NavItemProps, 'type'>[] = [
  { id: 'advantages', title: 'header.advantages', link: '#Advantages' },
  { id: 'for-who', title: 'header.for_who', link: '#forWhoSection' },
  { id: 'integration', title: 'header.integration', link: '#Integration' },
  { id: 'contacts', title: 'header.contacts', link: '#Contacts' },
];

describe('landing header navigation lists', () => {
  test('the header menu links every landing section in order, typed for the header', () => {
    expect(headerNavList).toEqual(sectionLinks.map(item => ({ ...item, type: 'header' })));
  });

  test('the drawer menu links the same sections in the same order, typed for the drawer', () => {
    expect(drawerNavList).toEqual(sectionLinks.map(item => ({ ...item, type: 'drawer' })));
  });

  test('the two menus are independent arrays and items', () => {
    expect(drawerNavList).not.toBe(headerNavList);
    drawerNavList.forEach((item, index) => {
      expect(item).not.toBe(headerNavList[index]);
    });
  });

  test('every drawer social link keeps its accessible-name key and drawer type', () => {
    expect(socialMedia.map(({ id, ariaLabel, type }) => ({ id, ariaLabel, type }))).toEqual([
      {
        id: 'instagram-link',
        ariaLabel: 'header.drawer.aria_labels_social_images.instagram',
        type: 'drawer',
      },
      {
        id: 'gitHub-link',
        ariaLabel: 'header.drawer.aria_labels_social_images.github',
        type: 'drawer',
      },
      {
        id: 'facebook-link',
        ariaLabel: 'header.drawer.aria_labels_social_images.facebook',
        type: 'drawer',
      },
      {
        id: 'linkedin-link',
        ariaLabel: 'header.drawer.aria_labels_social_images.linkedin',
        type: 'drawer',
      },
    ]);
  });
});
