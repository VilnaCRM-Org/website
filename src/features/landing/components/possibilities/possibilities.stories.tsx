import { Meta, StoryObj } from '@storybook/nextjs';

import Possibilities from './possibilities';

const meta: Meta<typeof Possibilities> = {
  title: 'Components/Possibilities',
  component: Possibilities,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof Possibilities>;

export const Default: Story = {};
