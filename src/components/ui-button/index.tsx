import ToolkitUiButton from '@vilnacrm/ui-toolkit/ui-button';
import React from 'react';

import type { UiButtonProps } from './types';

type AnchorProps = Pick<UiButtonProps, 'rel' | 'target' | 'href'>;

function presentAnchorProps({ rel, target, href }: AnchorProps): AnchorProps {
  return {
    ...(rel ? { rel } : {}),
    ...(target ? { target } : {}),
    ...(href ? { href } : {}),
  };
}

function UiButton({ rel, target, href, ...buttonProps }: UiButtonProps): React.ReactElement {
  return <ToolkitUiButton {...buttonProps} {...presentAnchorProps({ rel, target, href })} />;
}

export default UiButton;
