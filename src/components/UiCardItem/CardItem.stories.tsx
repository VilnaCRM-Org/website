import type { Meta, StoryObj } from '@storybook/react';
import type { ReactElement } from 'react';

import UiCardList from '../UiCardList';
import { CardList } from '../UiCardList/types';

import { LARGE_CARD_ITEM, SMALL_CARD_ITEM } from './constants';

const meta: Meta<typeof UiCardList> = {
  title: 'UiComponents/UiCardItem',
  component: UiCardList,
  tags: ['autodocs'],
};

export default meta;

// Используем деструктуризацию аргументов и правильный тип возвращаемого значения
function CardItem({ cardList }: CardList): ReactElement {
  return <UiCardList cardList={cardList} />;
}

type Story = StoryObj<typeof CardItem>;

export const CardItemLarge: Story = {
  args: {
    cardList: [LARGE_CARD_ITEM],
  },
};

export const CardItemSmall: Story = {
  args: {
    cardList: [SMALL_CARD_ITEM],
  },
};