import { Meta, StoryObj } from '@storybook/nextjs';

import NotFound from './not-found';

const meta: Meta<typeof NotFound> = {
  title: 'Components/NotFound/NotFound',
  component: NotFound,
  tags: ['autodocs'],
  parameters: {
    layout: '',
  },
};

export default meta;

type Story = StoryObj<typeof NotFound>;

export const Default: Story = {};
