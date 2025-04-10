import React from 'react';
import { Meta, StoryObj } from '@storybook/react';
import ForWhoSection from './ForWhoSection';

const meta: Meta<typeof ForWhoSection> = {
  title: 'Sections/ForWhoSection',
  component: ForWhoSection,
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof ForWhoSection>;

export const Default: Story = {
  render: () => <ForWhoSection />,
};
