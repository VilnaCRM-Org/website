const mainLanguage = process.env.NEXT_PUBLIC_MAIN_LANGUAGE;
const fallbackLanguage = process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

if (!mainLanguage || !fallbackLanguage) {
  throw new Error('Missing required environment variables for localization');
}

import localization from '../../pages/i18n/localization.json';

const getResources = () => localization;

export default {
  lng: mainLanguage,
  resources: getResources(),
  fallbackLng: fallbackLanguage,
  interpolation: {
    escapeValue: false,
  },
};
