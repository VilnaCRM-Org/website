import { ReactNode } from 'react';

export type CardItem = {
  type: string;
  id: string;
  imageSrc: string;
  title: string;
  text: string;
  alt: string;
};

export interface CardList {
  cardList: CardItem[];
  // Optional render slot for a card's tooltip content (e.g. the landing
  // ServicesHoverCard), injected by the feature so shared card components stay
  // feature-agnostic.
  hoverCardContent?: ReactNode;
}
