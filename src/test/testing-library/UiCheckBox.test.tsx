import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { UiCheckbox } from '@/components';

import { testText } from './constants';

const mockOnChange: () => void = jest.fn();

describe('UiCheckbox', () => {
  it('renders the checkbox with the provided label', () => {
    const { getByLabelText } = render(<UiCheckbox label={testText} onChange={mockOnChange} />);
    const checkboxLabel: HTMLElement = getByLabelText(testText);

    expect(checkboxLabel).toBeInTheDocument();
  });

  it('calls the onChange function when the checkbox is clicked', () => {
    const { getByRole } = render(<UiCheckbox onChange={mockOnChange} label={testText} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');
    fireEvent.click(checkboxInput);
    expect(mockOnChange).toHaveBeenCalled();
  });

  it('disables the checkbox when the disabled prop is true', () => {
    const { getByRole } = render(<UiCheckbox disabled onChange={mockOnChange} label={testText} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');
    expect(checkboxInput).toBeDisabled();
  });

  it('applies default style when there is no error', async () => {
    const { getByRole } = render(<UiCheckbox label="Test" onChange={mockOnChange} />);

    const checkboxInput: HTMLElement = getByRole('checkbox');

    expect(checkboxInput).toHaveStyle('border-color: #D0D4D8');

    fireEvent.mouseOver(checkboxInput);

    await waitFor(() => {
      expect(checkboxInput).toHaveStyle('border-color: #1EAEFF');
    });
  });

  it('applies error style when error prop is true', () => {
    const { getByRole } = render(<UiCheckbox error label={testText} onChange={mockOnChange} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');

    expect(checkboxInput).toHaveStyle('border-color: #DC3939');
  });
  it('controls checkbox state with checked prop', () => {
    const { getByRole, rerender } = render(
      <UiCheckbox label="Test" onChange={mockOnChange} checked />
    );

    const checkboxInput: HTMLElement = getByRole('checkbox');
    expect(checkboxInput).toBeChecked();

    rerender(<UiCheckbox label="Test" onChange={mockOnChange} checked={false} />);
    expect(checkboxInput).not.toBeChecked();
  });
});
