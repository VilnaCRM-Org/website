import type { AuthorizeDialogPlugin } from '../authorize-dialog/types';
import type { ResponsesTablePlugin } from '../responses-table/types';
import type { ServersLabelPlugin } from '../servers/types';

export type SwaggerPlugin = ServersLabelPlugin | AuthorizeDialogPlugin | ResponsesTablePlugin;
