import type { ButtonHTMLAttributes, ComponentType, SVGProps } from 'react';

export type CloseIconProps = SVGProps<SVGSVGElement>;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

export type CloseIconWrapper = (
  Original: ComponentType<CloseIconProps>
) => ComponentType<CloseIconProps>;

export type ButtonWrapper = (Original: ComponentType<ButtonProps>) => ComponentType<ButtonProps>;

export interface AuthorizeDialogPlugin {
  wrapComponents: {
    CloseIcon: CloseIconWrapper;
    Button: ButtonWrapper;
  };
}
