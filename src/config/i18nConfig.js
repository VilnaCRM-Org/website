const mainLanguage = process.env.NEXT_PUBLIC_MAIN_LANGUAGE;
const fallbackLanguage = process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE;

if (!mainLanguage || !fallbackLanguage) {
  throw new Error('Missing required environment variables for localization');
}

const getResources = () => {
  try {
    // eslint-disable-next-line global-require
    return require('../../pages/i18n/localization.json');
  } catch (error) {
    throw new Error(`Failed to load localization resources: ${error.message}`);
  }
};

module.exports = {
  lng: process.env.NEXT_PUBLIC_MAIN_LANGUAGE,
  resources: getResources(),
  fallbackLng: process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
};
