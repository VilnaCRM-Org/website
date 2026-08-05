import { SxProps, Theme } from '@mui/material';

// Split into two short unions rather than one long one: a union that fits on a
// single line is wrapped differently by the repo's Prettier and Qlty's, so this
// keeps the file stable under both.
export type UiTypographyTextTag = 'section' | 'p' | 'div' | 'span' | 'a' | 'label';
export type UiTypographyHeadingTag = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
export type UiTypographyComponent = UiTypographyTextTag | UiTypographyHeadingTag;

export interface UiTypographyProps {
  sx?: SxProps<Theme>;
  variant?:
    | 'h1'
    | 'h2'
    | 'h3'
    | 'h4'
    | 'h5'
    | 'h6'
    | 'medium16'
    | 'medium15'
    | 'medium14'
    | 'regular16'
    | 'bodyText18'
    | 'bodyText16'
    | 'bold22'
    | 'demi18'
    | 'button'
    | 'mobileText';
  children: React.ReactNode;
  component?: UiTypographyComponent;
  id?: string | undefined;
  role?: React.AriaRole;
  htmlFor?: string;
  'aria-live'?: 'off' | 'polite' | 'assertive' | undefined;
  'aria-atomic'?: boolean | undefined;
}
