import { render, fireEvent } from '@testing-library/react';

import { UiInput } from '@/components';

import { testText, testEmail, testPlaceholder } from './constants';

const testType: string = 'email';

describe('UiInput', () => {
  it('renders the input with the provided props', () => {
    const { getByPlaceholderText } = render(
      <UiInput placeholder={testPlaceholder} type={testType} value={testEmail} />
    );
    const inputElement: HTMLElement = getByPlaceholderText(testPlaceholder);
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveAttribute('type', testType);
    expect(inputElement).toHaveValue(testEmail);
  });

  it('calls the onChange function when the input value changes', () => {
    const mockOnChange: () => void = jest.fn();
    const { getByRole } = render(<UiInput onChange={mockOnChange} />);
    const inputElement: HTMLElement = getByRole('textbox');
    fireEvent.change(inputElement, { target: { value: testText } });
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('calls the onBlur function when the input loses focus', () => {
    const mockOnBlur: () => void = jest.fn();
    const { getByRole } = render(<UiInput onBlur={mockOnBlur} />);
    const inputElement: HTMLElement = getByRole('textbox');
    fireEvent.blur(inputElement);
    expect(mockOnBlur).toHaveBeenCalled();
  });

  it('applies the correct styles based on the error prop', () => {
    const { rerender, getByRole } = render(<UiInput error={false} />);
    let inputElement: HTMLElement = getByRole('textbox');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveAttribute('aria-invalid', 'false');

    rerender(<UiInput error />);
    inputElement = getByRole('textbox');
    expect(inputElement).toBeInTheDocument();
    expect(inputElement).toHaveAttribute('aria-invalid', 'true');
  });

  it('disables the input when the disabled prop is true', () => {
    const { getByRole } = render(<UiInput disabled />);
    const inputElement: HTMLElement = getByRole('textbox');
    expect(inputElement).toBeDisabled();
  });

  // #382 F3: without `name` + `autocomplete` a password manager cannot see the
  // credential fields, so it never offers to generate a strong password.
  it('forwards identity and autofill attributes to the rendered input', () => {
    const { getByRole } = render(<UiInput id="Email" name="Email" autoComplete="email" />);
    const inputElement: HTMLElement = getByRole('textbox');

    expect(inputElement).toHaveAttribute('id', 'Email');
    expect(inputElement).toHaveAttribute('name', 'Email');
    expect(inputElement).toHaveAttribute('autocomplete', 'email');
  });

  it('puts aria-describedby on the input itself, not on the wrapper', () => {
    const { getByRole } = render(<UiInput describedBy="hint-id" />);
    const inputElement: HTMLElement = getByRole('textbox');

    expect(inputElement).toHaveAttribute('aria-describedby', 'hint-id');
    expect(inputElement.closest('.MuiFormControl-root')).not.toHaveAttribute('aria-describedby');
  });

  it('omits the optional attributes entirely when they are not supplied', () => {
    const { getByRole } = render(<UiInput />);
    const inputElement: HTMLElement = getByRole('textbox');

    expect(inputElement).not.toHaveAttribute('aria-describedby');
    expect(inputElement).not.toBeRequired();
  });

  it('marks a required field for assistive tech without enabling native validation', () => {
    const { getByRole } = render(<UiInput required />);
    const inputElement: HTMLElement = getByRole('textbox');

    expect(inputElement).toBeRequired();
    // Required is announced through ARIA only: the native attribute would let
    // the browser block submission before react-hook-form ever produced its
    // localized message.
    expect(inputElement.getAttributeNames()).toContain('aria-required');
    expect(inputElement.getAttributeNames()).not.toContain('required');
  });
});
