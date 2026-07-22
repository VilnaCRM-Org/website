import type { StorybookConfig } from '@storybook/nextjs';

const toPath = 'src/assets/fonts';
const fromPath = `../${toPath}`;

const config: StorybookConfig = {
  stories: ['../src/**/*.mdx', '../src/**/*.stories.@(js|jsx|mjs|ts|tsx)'],
  addons: ['@storybook/addon-links', '@storybook/addon-onboarding'],

  framework: {
    name: '@storybook/nextjs',
    options: {},
  },

  staticDirs: [
    {
      from: `${fromPath}/Golos/GolosText-Black.woff2`,
      to: `${toPath}/Golos/GolosText-Black.woff2`,
    },
    {
      from: `${fromPath}/Golos/GolosText-Bold.woff2`,
      to: `${toPath}/Golos/GolosText-Bold.woff2`,
    },
    {
      from: `${fromPath}/Golos/GolosText-ExtraBold.woff2`,
      to: `${toPath}/Golos/GolosText-ExtraBold.woff2`,
    },
    {
      from: `${fromPath}/Golos/GolosText-Medium.woff2`,
      to: `${toPath}/Golos/GolosText-Medium.woff2`,
    },
    {
      from: `${fromPath}/Golos/GolosText-Regular.woff2`,
      to: `${toPath}/Golos/GolosText-Regular.woff2`,
    },
    {
      from: `${fromPath}/Golos/GolosText-SemiBold.woff2`,
      to: `${toPath}/Golos/GolosText-SemiBold.woff2`,
    },
    {
      from: `${fromPath}/Inter/Inter-Bold.woff2`,
      to: `${toPath}/Inter/Inter-Bold.woff2`,
    },
    {
      from: `${fromPath}/Inter/Inter-Medium.woff2`,
      to: `${toPath}/Inter/Inter-Medium.woff2`,
    },
    {
      from: `${fromPath}/Inter/Inter-Regular.woff2`,
      to: `${toPath}/Inter/Inter-Regular.woff2`,
    },
  ],
};
export default config;
