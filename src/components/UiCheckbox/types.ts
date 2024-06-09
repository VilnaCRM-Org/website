export interface UiCheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string | React.ReactNode;
  sx?: React.CSSProperties;
  error?: boolean;
}
