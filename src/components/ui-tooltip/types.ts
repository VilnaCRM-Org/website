export interface UiTooltipProps {
  children: React.ReactNode;
  title: string | React.ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right' | undefined;
  arrow?: boolean | undefined;
  sx?: React.CSSProperties | undefined;
}
