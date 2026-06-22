import type { Meta, StoryObj } from '@storybook/nextjs';

import UiFooter from './ui-footer';

const meta: Meta<typeof UiFooter> = {
  title: 'UiComponents/UiFooter',
  component: UiFooter,
  tags: ['autodocs'],
};

export default meta;

type Story = StoryObj<typeof UiFooter>;

export const Footer: Story = {};
