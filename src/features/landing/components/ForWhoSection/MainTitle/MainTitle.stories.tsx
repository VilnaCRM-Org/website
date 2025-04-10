import { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import MainTitle from './MainTitle';

const meta: Meta<typeof MainTitle> = {
  title: 'Components/ForWhoSection/MainTitle',
  component: MainTitle,
  parameters: {
    layout: 'centered',
  },
};

export default meta;

type Story = StoryObj<typeof MainTitle>;

export const Default: Story = {
  render: () => <MainTitle />,
};
