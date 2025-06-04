import { t } from './initializeLocalization';

export const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));
