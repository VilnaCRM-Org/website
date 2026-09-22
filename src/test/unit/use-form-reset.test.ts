/**
 * @jest-environment jsdom
 */
/**
 * Client-layer coverage for the landing `useFormReset` hook (issue #456): pins the exact
 * reset payload, not just that `reset` was called — a `{}` mutant also passes a bare
 * call-count check.
 *
 * jsdom is declared per file because `src/test/unit` also runs under the node (server)
 * layer, where `renderHook` has no document to mount into.
 *
 * Loading/error — the `error` notification guard is the error path.
 * Permission/auth — Not applicable: the sign-up form has no authenticated state.
 */
import { renderHook } from '@testing-library/react';

import useFormReset from '../../features/landing/hooks/useFormReset';
import { RegisterItem } from '../../features/landing/types/authentication/form';

type HookProps = { formState: { isSubmitSuccessful: boolean }; notificationType?: string };

const emptyForm: RegisterItem = {
  Email: '',
  FullName: '',
  Password: '',
  ConfirmPassword: '',
  Privacy: false,
  Referral: '',
};

describe('useFormReset', () => {
  let reset: jest.Mock;

  const renderReset = (initialProps: HookProps): ReturnType<typeof renderHook<void, HookProps>> =>
    renderHook((props: HookProps) => useFormReset({ ...props, reset }), { initialProps });

  beforeEach(() => {
    reset = jest.fn();
  });

  it('resets every field to its empty value after a successful submit', () => {
    renderReset({ formState: { isSubmitSuccessful: true }, notificationType: 'success' });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(emptyForm);
  });

  it('resets when the submit succeeded and no notification type is set yet', () => {
    renderReset({ formState: { isSubmitSuccessful: true } });

    expect(reset).toHaveBeenCalledWith(emptyForm);
  });

  it('does not reset while the submit has not succeeded', () => {
    renderReset({ formState: { isSubmitSuccessful: false }, notificationType: 'success' });

    expect(reset).not.toHaveBeenCalled();
  });

  it('keeps the entered values when the submit ended in an error', () => {
    renderReset({ formState: { isSubmitSuccessful: true }, notificationType: 'error' });

    expect(reset).not.toHaveBeenCalled();
  });

  it('resets once the submit flips to successful', () => {
    const { rerender } = renderReset({
      formState: { isSubmitSuccessful: false },
      notificationType: 'success',
    });
    expect(reset).not.toHaveBeenCalled();

    rerender({ formState: { isSubmitSuccessful: true }, notificationType: 'success' });

    expect(reset).toHaveBeenCalledTimes(1);
    expect(reset).toHaveBeenCalledWith(emptyForm);
  });

  it('does not reset again on a rerender with the same state', () => {
    const { rerender } = renderReset({
      formState: { isSubmitSuccessful: true },
      notificationType: 'success',
    });

    rerender({ formState: { isSubmitSuccessful: true }, notificationType: 'success' });

    expect(reset).toHaveBeenCalledTimes(1);
  });
});
