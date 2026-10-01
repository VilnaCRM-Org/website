import type { Preview } from '@storybook/nextjs';
import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';

import resources from '../pages/i18n/localization.json';

// The `@font-face` rules live here now, not in `next/font`. Storybook's Next
// framework integration used to resolve the generated families for free; with
// the faces declared under their real names in the stylesheet, Storybook has to
// load it or every toolkit component renders in a fallback face — the theme
// asks for `Golos Text`/`Inter` by name and nothing would declare them.
// Webpack bundles the `.woff2` files those `url()`s name and loads them relative
// to the build, so they also resolve under the GitHub Pages sub-path (#523).
import '../styles/global.css';

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
