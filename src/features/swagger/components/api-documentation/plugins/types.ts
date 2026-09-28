import type { AuthorizeDialogPlugin } from '../authorize-dialog/types';
import type { ResponsesTablePlugin } from '../responses-table/types';
import type { ServersLabelPlugin } from '../servers/types';
import type { SpecLoadPlugin } from '../spec-load/types';

type ComponentPlugin = ServersLabelPlugin | AuthorizeDialogPlugin | ResponsesTablePlugin;

export type SwaggerPlugin = ComponentPlugin | SpecLoadPlugin;
