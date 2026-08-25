import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { UiTextFieldForm } from '@/components';

import { testPlaceholder, testText } from './constants';

const labelText: string = 'Test field';
const requiredMessage: string = 'This field is required';
const hintId: string = 'test-field-hint';

// Props are declared required so every render states its intent; the rendered
// component treats an empty string as 'no external description'.
interface TestWrapperProps {
  describedBy: string;
}

describe('UiTextFieldForm', () => {
  function TestWrapper({ describedBy }: TestWrapperProps): React.ReactElement {
    const { control, handleSubmit } = useForm();
    const onSubmit: () => void = jest.fn();

    return (
      <form onSubmit={handleSubmit(onSubmit)}>
        <label htmlFor="testField">{labelText}</label>
        <UiTextFieldForm
          id="testField"
          control={control}
          name="testField"
          rules={{ required: requiredMessage, minLength: 5 }}
          placeholder={testPlaceholder}
          type="text"
          autoComplete="username"
          describedBy={describedBy}
          fullWidth
        />
        <span id={hintId}>hint</span>
        <button type="submit">Submit</button>
      </form>
    );
  }

  it('renders the UiInput component with the correct props', () => {
    render(<TestWrapper describedBy="" />);

    const uiInput: HTMLElement = screen.getByRole('textbox');

    expect(uiInput).toHaveAttribute('type', 'text');
    expect(uiInput).toHaveAttribute('placeholder', testPlaceholder);
    expect(uiInput).toHaveValue('');
    expect(uiInput).not.toHaveAttribute('error');
  });

  it('updates the form field value on input change', () => {
    render(<TestWrapper describedBy="" />);

    const uiInput: HTMLElement = screen.getByRole('textbox');

    fireEvent.change(uiInput, { target: { value: testText } });

    expect(uiInput).toHaveValue(testText);
  });

  // #382 F3: the id used to be dropped, so every sibling <label htmlFor> in the
  // sign-up form pointed at nothing and the field was unreachable by label.
  it('forwards id, name and autocomplete so the field is labelled and autofillable', () => {
    render(<TestWrapper describedBy="" />);

    const uiInput: HTMLElement = screen.getByLabelText(labelText);

    expect(uiInput).toHaveAttribute('id', 'testField');
    expect(uiInput).toHaveAttribute('name', 'testField');
    expect(uiInput).toHaveAttribute('autocomplete', 'username');
    expect(uiInput).toBeRequired();
  });

  it('renders the validation message in a live region that exists before it fills', () => {
    render(<TestWrapper describedBy="" />);

    const liveRegion: HTMLElement | null = document.getElementById('testField-error');

    expect(liveRegion).toBeInTheDocument();
    expect(liveRegion).toHaveAttribute('aria-live', 'polite');
    expect(liveRegion).toBeEmptyDOMElement();
  });

  it('describes the input with its validation message once the field is invalid', async () => {
    render(<TestWrapper describedBy="" />);

    const uiInput: HTMLElement = screen.getByLabelText(labelText);
    expect(uiInput).not.toHaveAttribute('aria-describedby');

    fireEvent.blur(uiInput);
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByText(requiredMessage)).toBeInTheDocument();
      expect(uiInput).toHaveAttribute('aria-describedby', 'testField-error');
      expect(uiInput).toHaveAttribute('aria-invalid', 'true');
    });
  });

  it('composes an external description with the validation message', async () => {
    render(<TestWrapper describedBy={hintId} />);

    const uiInput: HTMLElement = screen.getByLabelText(labelText);
    expect(uiInput).toHaveAttribute('aria-describedby', hintId);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(uiInput).toHaveAttribute('aria-describedby', `${hintId} testField-error`);
    });
  });
});
