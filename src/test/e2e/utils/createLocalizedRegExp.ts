import { t } from './initializeLocalization';

 const createLocalizedRegExp: (key: string) => RegExp = key => new RegExp(t(key));

export default createLocalizedRegExp;