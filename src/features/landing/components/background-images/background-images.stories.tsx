import { Meta, StoryObj } from '@storybook/nextjs';

import BackgroundImages from './background-images';

const meta: Meta<typeof BackgroundImages> = {
  title: 'Components/BackgroundImages',
  component: BackgroundImages,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof BackgroundImages>;

export const Default: Story = {};
