const i18n = require('i18next');
const { initReactI18next } = require('react-i18next');
const { loadEnvConfig } = require('@next/env');
const resources = require('../../../../pages/i18n/localization.json');

const projectDir = process.cwd();
loadEnvConfig(projectDir);

i18n.use(initReactI18next).init({
  lng: process.env.NEXT_PUBLIC_MAIN_LANGUAGE,
  resources,
  fallbackLng: process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
});

module.exports = i18n;
