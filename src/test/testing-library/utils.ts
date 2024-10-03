import { t } from 'i18next';

export const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));
