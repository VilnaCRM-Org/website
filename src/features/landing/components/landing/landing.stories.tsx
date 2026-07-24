import { Meta, StoryObj } from '@storybook/nextjs';

import Landing from './landing';

const meta: Meta<typeof Landing> = {
  title: 'Components/Landing',
  component: Landing,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof Landing>;

export const Default: Story = {};
