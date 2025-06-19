const mainLanguage = process.env.NEXT_PUBLIC_MAIN_LANGUAGE;
const fallbackLanguage = process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

if (!mainLanguage || !fallbackLanguage) {
  throw new Error('Missing required environment variables for localization');
}

let localization;

try {
  localization = require('../../pages/i18n/localization.json');
} catch (err) {
  throw new Error(`Failed to load localization resources: ${err.message}`);
}

const getResources = () => localization;

export default {
  lng: mainLanguage,
  resources: getResources(),
  fallbackLng: fallbackLanguage,
  interpolation: {
    escapeValue: false,
  },
};
