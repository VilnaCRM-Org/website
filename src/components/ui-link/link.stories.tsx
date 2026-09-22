import type { Meta, StoryObj } from '@storybook/nextjs';
import { t } from 'i18next';

import { textArgType } from '../../../.storybook/story-arg-types';

import UiLink from './index';

const meta: Meta<typeof UiLink> = {
  title: 'UiComponents/UiLink',
  component: UiLink,
  tags: ['autodocs'],
  argTypes: {
    children: textArgType('Text for the link'),
    href: textArgType('Link URL'),
  },
};

export default meta;

type Story = StoryObj<typeof UiLink>;

export const Link: Story = {
  args: {
    children: t('Link'),
    href: '/',
  },
};
