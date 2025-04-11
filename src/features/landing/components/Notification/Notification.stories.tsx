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
      options: [NotificationStatus.ERROR, NotificationStatus.SUCCESS],
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

const storyContainerStyle: React.CSSProperties = {
  width: '31.375rem',
  minHeight: '46.6rem',
  position: 'relative',
};

export const NotificationDefault: Story = {
  args: {
    type: NotificationStatus.SUCCESS,
    isOpen: true,
  },
  render: args => (
    <div style={storyContainerStyle}>
      <Notification {...args} />
    </div>
  ),
};
export const NotificationFallback: Story = {
  args: {
    type: 'unknown' as NotificationStatus,
    isOpen: true,
  },
  render: args => (
    <div style={storyContainerStyle}>
      <Notification {...args} />
    </div>
  ),
};
