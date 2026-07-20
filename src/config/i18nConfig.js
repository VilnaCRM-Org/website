import { env } from './env';

const getResources = () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, global-require
    return require('../../pages/i18n/localization.json');
  } catch (error) {
    throw new Error(`Failed to load localization resources: ${error.message}`);
  }
};

export default {
  lng: env.NEXT_PUBLIC_MAIN_LANGUAGE,
  resources: getResources(),
  fallbackLng: env.NEXT_PUBLIC_FALLBACK_LANGUAGE,
  interpolation: {
    escapeValue: false,
  },
};
