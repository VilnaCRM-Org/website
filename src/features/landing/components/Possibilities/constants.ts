import { CardItem } from '@/components/UiCardItem/types';
import  getWhyUsCards  from '@/components/UiCardList/cardData';

import Diamond from '../../assets/svg/possibilities/diamond.svg';

export const cardList: CardItem[] = getWhyUsCards().map(card => ({
  ...card,
  imageSrc: card.image || Diamond,
  image: card.image ||  Diamond,
}));