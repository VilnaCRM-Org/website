import type { InitOptions } from 'i18next';

import resources from '../../pages/i18n/localization.json';

import { env } from './env';

const i18nConfig: InitOptions = {
  lng: env.NEXT_PUBLIC_MAIN_LANGUAGE,
  resources,
  fallbackLng: env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
};

export default i18nConfig;
