import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import Cards from './Cards';

const meta: Meta<typeof Cards> = {
  title: 'Components/ForWhoSection/Cards',
  component: Cards,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof Cards>;

export const Default: Story = {
  render: () => <Cards />,
};
