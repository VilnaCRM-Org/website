export interface UiInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  sx?: React.CSSProperties;
  error?: boolean;
  fullWidth?: boolean;
}
