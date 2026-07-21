import { createRequire } from 'node:module';
import nextEnv from '@next/env';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const { loadEnvConfig } = nextEnv;

loadEnvConfig(process.cwd());

// Decoupled from src/config/i18nConfig, which now imports the TypeScript env
// module (src/config/env.ts). This util runs under native Node ESM inside the
// Memlab image, where a `.ts` dependency cannot be resolved. Read the validated
// locale from the container environment (permitted under src/test) and load the
// generated bundle (pages/i18n/localization.json, #328) directly.
const require = createRequire(import.meta.url);
const resources = require('../../../../pages/i18n/localization.json');

await i18n.use(initReactI18next).init({
  lng: process.env.NEXT_PUBLIC_MAIN_LANGUAGE,
  fallbackLng: process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  resources,
  interpolation: { escapeValue: false },
});

export default i18n;
