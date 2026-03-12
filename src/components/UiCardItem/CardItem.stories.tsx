import type { Meta, StoryObj } from '@storybook/nextjs';

import UiCardList from '../UiCardList';
import { CardList } from '../UiCardList/types';

import { LARGE_CARD_ITEM, SMALL_CARD_ITEM } from './constants';

const meta: Meta<typeof UiCardList> = {
  title: 'UiComponents/UiCardItem',
  component: UiCardList,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof UiCardList>;

export const CardItemLarge: Story = {
  render: (args: CardList) => <UiCardList {...args} />,
  args: {
    cardList: [LARGE_CARD_ITEM],
  },
};
export const CardItemSmall: Story = {
  render: (args: CardList) => <UiCardList {...args} />,
  args: {
    cardList: [SMALL_CARD_ITEM],
  },
};
