
import { CardItem } from '@/components/UiCardItem/types';
import { getWhyUsCards } from '@/components/UiCardList/cardData';



export const cardList: CardItem[] = getWhyUsCards().map(card => ({
  ...card,
  imageSrc: card.imageSrc || '',
}));