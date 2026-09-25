import { AuthorizeDialogPlugin } from './types';
import { withCloseLabel } from './with-close-label';
import { withLabelInName } from './with-label-in-name';

export const authorizeDialogPlugin: AuthorizeDialogPlugin = {
  wrapComponents: {
    CloseIcon: withCloseLabel,
    Button: withLabelInName,
  },
};
