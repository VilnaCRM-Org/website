import Drupal from '@/assets/svg/TooltipIcons/Drupal.svg';
import Joomla from '@/assets/svg/TooltipIcons/Joomla.svg';
import Magento from '@/assets/svg/TooltipIcons/Magento.svg';
import Shopify from '@/assets/svg/TooltipIcons/Shopify.svg';
import Wix from '@/assets/svg/TooltipIcons/Wix.svg';
import WooCommerce from '@/assets/svg/TooltipIcons/WooCommerce.svg';
import WordPress from '@/assets/svg/TooltipIcons/WordPress.svg';
import Zapier from '@/assets/svg/TooltipIcons/Zapier.svg';

import { ImageList } from '../../types/possibilities/image-list';

export { SMALL_CARDLIST_ARRAY as cardList } from '@/components/ui-card-list/constants';

export const imageList: ImageList[] = [
  { image: Wix, alt: 'Wix' },
  { image: WordPress, alt: 'WordPress' },
  { image: Zapier, alt: 'Zapier' },
  { image: Shopify, alt: 'Shopify' },
  { image: Magento, alt: 'Magento' },
  { image: Joomla, alt: 'Joomla' },
  { image: Drupal, alt: 'Drupal' },
  { image: WooCommerce, alt: 'WooCommerce' },
];
