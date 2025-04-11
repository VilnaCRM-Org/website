import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';

import { NotificationStatus } from './types';

import Notification from './index';


const meta: Meta<typeof Notification> = {
  title: 'Notification',
  component: Notification,
  tags: ['autodocs'],
  argTypes: {
    type: {
      options: [NotificationStatus.ERROR, NotificationStatus.SUCCESS, 'unknown' as NotificationStatus],
      control: { type: 'radio' },
    },
    isOpen: {
      control: { type: 'boolean' },
    },
    setIsOpen: { action: 'setIsOpen' },
    onRetry: { action: 'onRetry' },
  },
};
export default meta;

type Story = StoryObj<typeof Notification>;

export const NotificationDefault: Story = {
  args: {
    type: NotificationStatus.SUCCESS,
    isOpen: true,
  },
  render: (args) => (
    <div style={{ width: '31.375rem', minHeight: '46.6rem', position: 'relative' }}>
      <Notification {...args} />
    </div>
  ),
};
