import type { Meta, StoryObj } from '@storybook/nextjs';

import Cards from './Cards';

const meta: Meta<typeof Cards> = {
  title: 'Components/ForWhoSection/Cards',
  component: Cards,
  tags: ['autodocs'],
  parameters: {
    layout: '',
  },
};

export default meta;

type Story = StoryObj<typeof Cards>;

export const Default: Story = {};
