import { Meta, StoryObj } from '@storybook/react';

import MainTitle from './MainTitle';

const meta: Meta<typeof MainTitle> = {
  title: 'Components/ForWhoSection/MainTitle',  
  component: MainTitle,
  tags: ['autodocs'],
  parameters: {
    layout: "",  
  },
};

export default meta;

type Story = StoryObj<typeof MainTitle>;

export const Default: Story = {};
