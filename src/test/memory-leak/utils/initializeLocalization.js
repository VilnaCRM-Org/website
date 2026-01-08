import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { loadEnvConfig } from '@next/env';
import i18nConfig from '../../../config/i18nConfig.js';

loadEnvConfig(process.cwd());

await i18n.use(initReactI18next).init(i18nConfig);

export default i18n;
