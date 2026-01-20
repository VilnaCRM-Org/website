import type { Preview } from '@storybook/nextjs';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import resources from '../pages/i18n/localization.json';

i18next.use(initReactI18next).init({
  resources,
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
const preview: Preview = {
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
  },
};

export default preview;
