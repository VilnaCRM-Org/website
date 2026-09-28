import { version } from '../../package.json';

import { isProductionBuild } from './env';

export const APP_VERSION: string = version;

export const APP_ENVIRONMENT: string = isProductionBuild() ? 'production' : 'development';
