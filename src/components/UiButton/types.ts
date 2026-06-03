import { ButtonProps } from '@mui/material';
import { AnchorHTMLAttributes, ButtonHTMLAttributes } from 'react';

export type UiButtonProps = ButtonProps &
  ButtonHTMLAttributes<HTMLButtonElement> &
  AnchorHTMLAttributes<HTMLAnchorElement>;
