import React, { ComponentType } from 'react';

import { labelInName } from '../../../helpers/label-in-name';

import { ButtonProps } from './types';

export function withLabelInName(Original: ComponentType<ButtonProps>): ComponentType<ButtonProps> {
  function LabelInNameButton(props: ButtonProps): React.ReactElement {
    const { children, 'aria-label': ariaLabel } = props;

    return <Original {...props} aria-label={labelInName(children, ariaLabel)} />;
  }

  return LabelInNameButton;
}
