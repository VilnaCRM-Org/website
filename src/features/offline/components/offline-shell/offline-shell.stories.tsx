import { Meta, StoryObj } from '@storybook/nextjs';

import OfflineShell from './offline-shell';

const meta: Meta<typeof OfflineShell> = {
  title: 'Components/OfflineShell/OfflineShell',
  component: OfflineShell,
  tags: ['autodocs'],
  parameters: {
    layout: '',
  },
};

export default meta;

type Story = StoryObj<typeof OfflineShell>;

export const Default: Story = {};
