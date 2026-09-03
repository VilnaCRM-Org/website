import { UiButton as ToolkitUiButton } from '@vilnacrm/ui-toolkit';
import React from 'react';

import { UiButtonProps } from './types';

/**
 * `UiButton` renders the `@vilnacrm/ui-toolkit` button. The adapter survives the
 * swap only to re-add the `rel`/`target` anchor props the toolkit forwards but
 * does not declare — see `./types`. Everything else passes straight through.
 */
function UiButton({ rel, target, ...buttonProps }: UiButtonProps): React.ReactElement {
  const anchorProps: { rel?: string; target?: string } = {
    ...(rel ? { rel } : {}),
    ...(target ? { target } : {}),
  };

  return <ToolkitUiButton {...buttonProps} {...anchorProps} />;
}

export default UiButton;
