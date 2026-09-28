import { Meta, StoryObj } from '@storybook/nextjs';

import LandingSections from './landing-sections';

const meta: Meta<typeof LandingSections> = {
  title: 'Components/LandingSections',
  component: LandingSections,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof LandingSections>;

export const Default: Story = {};
