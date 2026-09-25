import { authorizeDialogPlugin } from '../authorize-dialog';
import { responsesTablePlugin } from '../responses-table';
import { serversLabelPlugin } from '../servers';
import { specLoadPlugin } from '../spec-load';

import { SwaggerPlugin } from './types';

export const swaggerPlugins: SwaggerPlugin[] = [
  serversLabelPlugin,
  authorizeDialogPlugin,
  responsesTablePlugin,
  specLoadPlugin,
];
