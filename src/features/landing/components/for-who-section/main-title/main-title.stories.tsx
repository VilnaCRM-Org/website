import { Meta, StoryObj } from '@storybook/nextjs';

import MainTitle from './main-title';

const meta: Meta<typeof MainTitle> = {
  title: 'Components/ForWhoSection/MainTitle',
  component: MainTitle,
  tags: ['autodocs'],
  parameters: {
    layout: '',
  },
};

export default meta;

type Story = StoryObj<typeof MainTitle>;

export const Default: Story = {};
