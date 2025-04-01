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
    const { container } = render(<UiCheckbox label="Test" onChange={mockOnChange} />);

    const checkboxInput: Element | null = container.querySelector('input[type="checkbox"]');

    expect(checkboxInput).toHaveStyle('border-color: #D0D4D8');

    if (checkboxInput) {
      fireEvent.mouseOver(checkboxInput);
    }

    await waitFor(() => {
      if (checkboxInput) {
        expect(checkboxInput).toHaveStyle('border-color: #1EAEFF');
      }
    });
  });

  it('applies error style when error prop is true', () => {
    const { getByRole } = render(<UiCheckbox error label={testText} onChange={mockOnChange} />);
    const checkboxInput: HTMLElement = getByRole('checkbox');

    expect(checkboxInput).toHaveStyle('border-color: #DC3939');
  });
});
