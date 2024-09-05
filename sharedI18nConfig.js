const resources = require('./pages/i18n/localization.json');

module.exports = {
  lng: process.env.NEXT_PUBLIC_MAIN_LANGUAGE,
  resources,
  fallbackLng: process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
};
