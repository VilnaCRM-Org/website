import { UiButton as ToolkitUiButton } from '@vilnacrm/ui-toolkit';
import React from 'react';

import { UiButtonProps } from './types';

/**
 * `UiButton` renders the `@vilnacrm/ui-toolkit` button. The adapter survives the
 * swap only to re-add the `rel`/`target` anchor props the toolkit forwards but
 * does not declare — see `./types` — and to keep MUI's `href` contract the
 * component this replaced had: an empty `href` makes MUI render an `<a>` with no
 * destination instead of the `<button>` the caller asked for, so a falsy value
 * is dropped rather than forwarded. Everything else passes straight through.
 */
function UiButton({ rel, target, href, ...buttonProps }: UiButtonProps): React.ReactElement {
  const anchorProps: { rel?: string; target?: string; href?: string } = {
    ...(rel ? { rel } : {}),
    ...(target ? { target } : {}),
    ...(href ? { href } : {}),
  };

  return <ToolkitUiButton {...buttonProps} {...anchorProps} />;
}

export default UiButton;
