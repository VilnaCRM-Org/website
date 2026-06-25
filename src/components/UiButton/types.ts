import { ButtonProps } from '@mui/material';
import { HTMLAttributeAnchorTarget } from 'react';

export type UiButtonProps = ButtonProps & {
  rel?: string;
  target?: HTMLAttributeAnchorTarget;
};
