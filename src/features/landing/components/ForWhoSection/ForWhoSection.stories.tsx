import { Meta, StoryObj } from '@storybook/react';

import ForWhoSection from './ForWhoSection';

const meta: Meta<typeof ForWhoSection> = {
  title: 'Components/ForWhoSection/ForWhoSection',  
  component: ForWhoSection,
  tags: ['autodocs'],
  parameters: {
    layout: "",  
  },
};

export default meta;

type Story = StoryObj<typeof ForWhoSection>;

export const Default: Story = {};