import { ReactNode } from 'react';

export type CardItem = {
  type: string;
  id: string;
  imageSrc: string;
  title: string;
  text: string;
  alt: string;
};

export interface UiCardItemProps {
  item: CardItem;
  hoverCardContent?: ReactNode;
}

export interface CardContentProps {
  item: CardItem;
  isSmallCard: boolean;
  hoverCardContent?: ReactNode;
}
