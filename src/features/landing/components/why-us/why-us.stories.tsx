import { Meta, StoryObj } from '@storybook/nextjs';

import WhyUs from './why-us';

const meta: Meta<typeof WhyUs> = {
  title: 'Components/WhyUs',
  component: WhyUs,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof WhyUs>;

export const Default: Story = {};
