import type { Decorator, Meta, StoryObj } from '@storybook/nextjs';
import { t } from 'i18next';

import { textArgType } from '../../../.storybook/story-arg-types';

import { UiSkipLinkProps } from './types';

import UiSkipLink from './index';

const withSkipTarget: Decorator<UiSkipLinkProps> = (Story, { args }) => (
  <>
    <Story />
    <span id={args.targetId} tabIndex={-1} />
  </>
);

const meta: Meta<typeof UiSkipLink> = {
  title: 'UiComponents/UiSkipLink',
  component: UiSkipLink,
  tags: ['autodocs'],
  decorators: [withSkipTarget],
  args: {
    label: t('header.layout.skip_to_content'),
    targetId: 'skip-target',
  },
  argTypes: {
    label: textArgType('Visible text once the link receives focus'),
    targetId: textArgType('Id of the element focus moves to when the link is activated'),
  },
};

export default meta;

type Story = StoryObj<typeof UiSkipLink>;

export const SkipLink: Story = {};

export const Focused: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector('a')?.focus();
  },
};
