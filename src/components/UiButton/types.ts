export interface UiButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'outlined' | 'contained';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  fullWidth?: boolean;
  sx?: React.CSSProperties;
}
