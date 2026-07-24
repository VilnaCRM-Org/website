import { Meta, StoryObj } from '@storybook/nextjs';

import AuthSection from './auth-section';

const meta: Meta<typeof AuthSection> = {
  title: 'Components/AuthSection',
  component: AuthSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof AuthSection>;

export const Default: Story = {};
