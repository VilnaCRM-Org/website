import type { Card } from '../../features/landing/types/Card/card-item';

import Diamond      from '../../features/landing/assets/svg/possibilities/diamond.svg';
import Ruby         from '../../features/landing/assets/svg/possibilities/ruby.svg';
import SmallDiamond from '../../features/landing/assets/svg/possibilities/smallDiamond.svg';
import SmallRuby    from '../../features/landing/assets/svg/possibilities/smallRuby.svg';

import getWhyUsCards from './cardData';
import { CardItem } from './types';

const whyUsCards: Card[] = getWhyUsCards();

export const LARGE_CARDLIST_ARRAY: CardItem[] = whyUsCards.map(card => ({
  ...card,
  image: card.image || '', 
  imageSrc: card.image || Diamond,
}));

export const SMALL_CARDLIST_ARRAY: CardItem[] = [
  {
    type: 'smallCard',
    id: 'item_1',
    imageSrc: Ruby,
    image: Ruby,
    text: 'unlimited_possibilities.cards_texts.text_for_cases',
    title: 'unlimited_possibilities.cards_headings.heading_public_api',
    alt: 'unlimited_possibilities.card_image_titles.title_for_first',
  },
  {
    type: 'smallCard',
    id: 'item_2',
    imageSrc: SmallDiamond,
    image: Ruby,
    text: 'unlimited_possibilities.cards_texts.text_integrate',
    title: 'unlimited_possibilities.cards_headings.heading_ready_plugins',
    alt: 'unlimited_possibilities.card_image_titles.title_for_second',
  },
  {
    type: 'smallCard',
    id: 'item_3',
    imageSrc: SmallRuby,
    image: Ruby,
    text: 'unlimited_possibilities.cards_texts.text_get_data',
    title: 'unlimited_possibilities.cards_headings.heading_system',
    alt: 'unlimited_possibilities.card_image_titles.title_for_third',
  },
  {
    type: 'smallCard',
    id: 'item_4',
    imageSrc: Diamond,
    image: Ruby,
    text: 'unlimited_possibilities.cards_texts.text_for_custom',
    title: 'unlimited_possibilities.cards_headings.heading_libraries',
    alt: 'unlimited_possibilities.card_image_titles.title_for_fourth',
  },
];
