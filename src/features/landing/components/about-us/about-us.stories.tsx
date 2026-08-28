import { Meta, StoryObj } from '@storybook/nextjs';

import AboutUs from './about-us';

const meta: Meta<typeof AboutUs> = {
  title: 'Components/AboutUs',
  component: AboutUs,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
};

export default meta;

type Story = StoryObj<typeof AboutUs>;

export const Default: Story = {};
