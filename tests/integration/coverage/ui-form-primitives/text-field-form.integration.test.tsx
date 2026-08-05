/**
 * Integration coverage: the form primitives behind every credential field
 * (`UiTextFieldForm` → `UiInput`), as wired by the sign-up form (#382 F3).
 *
 * The pair is mounted with a real `useForm` instance so the react-hook-form
 * plumbing — the forwarded ref, the field name, the error state — is exercised
 * end to end rather than stubbed. Each optional attribute is covered in both
 * its present and absent form, because a silently dropped prop is exactly the
 * defect this change fixes.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { useForm } from 'react-hook-form';

import { UiInput, UiTextFieldForm } from '@/components';

const labelText: string = 'Secret';
const requiredMessage: string = 'Required';
const hintId: string = 'secret-hint';

// Both props are required so each render states its intent explicitly; an
// empty `describedBy` means 'no external description'.
interface HarnessProps {
  describedBy: string;
  required: boolean;
}

function Harness({ describedBy, required }: HarnessProps): React.ReactElement {
  const { control, handleSubmit } = useForm({ mode: 'onTouched' });

  return (
    <form onSubmit={handleSubmit(jest.fn())}>
      <label htmlFor="Secret">{labelText}</label>
      <UiTextFieldForm
        id="Secret"
        control={control}
        name="Secret"
        rules={required ? { required: requiredMessage } : {}}
        placeholder="secret"
        type="password"
        autoComplete="new-password"
        describedBy={describedBy}
      />
      <span id={hintId}>policy</span>
      <button type="submit">Submit</button>
    </form>
  );
}

describe('integration: UiTextFieldForm and UiInput', () => {
  it('labels the field, names it, and marks it required for assistive tech', () => {
    render(<Harness describedBy="" required />);

    const input: HTMLElement = screen.getByLabelText(labelText);

    expect(input).toHaveAttribute('id', 'Secret');
    expect(input).toHaveAttribute('name', 'Secret');
    expect(input).toHaveAttribute('autocomplete', 'new-password');
    expect(input).toBeRequired();
  });

  it('omits aria-required when the field carries no required rule', () => {
    render(<Harness describedBy="" required={false} />);

    expect(screen.getByLabelText(labelText)).not.toBeRequired();
  });

  it('leaves aria-describedby off a valid field with no external description', () => {
    render(<Harness describedBy="" required />);

    expect(screen.getByLabelText(labelText)).not.toHaveAttribute('aria-describedby');
  });

  it('exposes only the external description before validation fails', () => {
    render(<Harness describedBy={hintId} required />);

    expect(screen.getByLabelText(labelText)).toHaveAttribute('aria-describedby', hintId);
  });

  it('appends the validation message id once the field is invalid', async () => {
    render(<Harness describedBy={hintId} required />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByLabelText(labelText)).toHaveAttribute(
        'aria-describedby',
        `${hintId} Secret-error`
      );
    });
  });

  it('describes the field by its message alone when there is no external description', async () => {
    render(<Harness describedBy="" required />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByLabelText(labelText)).toHaveAttribute('aria-describedby', 'Secret-error');
    });
  });

  it('keeps the message container mounted and empty while the field is valid', () => {
    render(<Harness describedBy="" required />);

    const region: HTMLElement | null = document.getElementById('Secret-error');

    expect(region).toBeInTheDocument();
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toBeEmptyDOMElement();
  });

  it('moves focus to the invalid field on submit through the forwarded ref', async () => {
    render(<Harness describedBy="" required />);

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    await waitFor(() => {
      expect(screen.getByLabelText(labelText)).toHaveFocus();
    });
  });

  it('falls back to the field name when no id is supplied', () => {
    function NoIdHarness(): React.ReactElement {
      const { control } = useForm();
      return (
        <UiTextFieldForm control={control} name="Fallback" rules={{}} placeholder="fallback" />
      );
    }

    render(<NoIdHarness />);

    expect(screen.getByPlaceholderText('fallback')).toHaveAttribute('id', 'Fallback');
    expect(document.getElementById('Fallback-error')).toBeInTheDocument();
  });

  // react-hook-form also accepts `required: { value, message }`; coercing the
  // object itself would announce a disabled rule as required.
  describe.each([
    [true, true],
    [false, false],
  ])('object-form required rule with value %s', (ruleValue: boolean, expected: boolean) => {
    function ObjectRuleHarness(): React.ReactElement {
      const { control } = useForm();
      return (
        <>
          <label htmlFor="Objecty">{labelText}</label>
          <UiTextFieldForm
            id="Objecty"
            control={control}
            name="Objecty"
            rules={{ required: { value: ruleValue, message: requiredMessage } }}
            placeholder="objecty"
          />
        </>
      );
    }

    it(`marks the field required: ${expected}`, () => {
      render(<ObjectRuleHarness />);

      const input: HTMLElement = screen.getByLabelText(labelText);

      if (expected) {
        expect(input).toBeRequired();
      } else {
        expect(input).not.toBeRequired();
      }
    });
  });

  it('renders a bare UiInput without any of the optional attributes', () => {
    render(<UiInput placeholder="bare" />);

    const input: HTMLElement = screen.getByPlaceholderText('bare');

    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toBeRequired();
    expect(input).not.toHaveAttribute('name');
    expect(input).not.toHaveAttribute('autocomplete');
  });
});
