import { authorizeDialogPlugin } from '../authorize-dialog';
import { responsesTablePlugin } from '../responses-table';
import { serversLabelPlugin } from '../servers';

import { SwaggerPlugin } from './types';

export const swaggerPlugins: SwaggerPlugin[] = [
  serversLabelPlugin,
  authorizeDialogPlugin,
  responsesTablePlugin,
];
