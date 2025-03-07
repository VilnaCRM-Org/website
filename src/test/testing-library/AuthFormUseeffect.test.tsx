import { waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';

import { testEmail, testInitials, testPassword } from '@/test/testing-library/constants';
import { mockRenderAuthForm } from '@/test/testing-library/mock-render/MockRenderAuthForm';
import { fillForm } from '@/test/testing-library/utils';

jest.mock('react-hook-form', () => ({
  useForm: jest.fn(),
  Controller: jest.fn(({ render }) =>
    render({
      field: { onChange: jest.fn() },
      fieldState: { errors: { Privacy: 'Privacy error' } },
    })
  ),
}));
describe('AuthForm useEffect behavior', () => {
  let mockReset: jest.Mock;
  let mockHandleSubmit: jest.Mock;

  beforeEach(() => {
    mockReset = jest.fn();
    mockHandleSubmit = jest.fn();

    (useForm as jest.Mock).mockReturnValue({
      handleSubmit: jest.fn(fn => fn),
      reset: jest.fn(),
      formState: {
        isSubmitSuccessful: true,
        errors: { Privacy: 'Privacy error' },
      },
      control: {},
      getValues: jest.fn(),
      setValue: jest.fn(),
    });
  });

  it('should reset form on successful submission with no errors and non-error notificationType', async () => {
    (useForm as jest.Mock).mockReturnValueOnce({
      handleSubmit: jest.fn(fn => fn),
      reset: mockReset,
      formState: { isSubmitSuccessful: true, errors: { Privacy: 'Privacy error' } },
      control: {},
    });

    mockRenderAuthForm({
      errorDetails: '',
      notificationType: 'success',
      mockOnSubmit: jest.fn(),
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() =>
      expect(mockReset).toHaveBeenCalledWith({
        Email: '',
        FullName: '',
        Password: '',
        Privacy: false,
      })
    );
  });

  it('should not reset form if there are error details', async () => {
    (useForm as jest.Mock).mockReturnValueOnce({
      handleSubmit: mockHandleSubmit,
      reset: mockReset,
      formState: { isSubmitSuccessful: true, errors: {} },
      control: {},
    });

    mockRenderAuthForm({
      errorDetails: 'Unexpected error',
      notificationType: 'success',
      mockOnSubmit: jest.fn(),
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => expect(mockReset).not.toHaveBeenCalled());
  });

  it('should not reset form if notificationType is "error"', async () => {
    (useForm as jest.Mock).mockReturnValueOnce({
      handleSubmit: mockHandleSubmit,
      reset: mockReset,
      formState: { isSubmitSuccessful: true, errors: {} },
      control: {},
    });

    mockRenderAuthForm({
      errorDetails: 'Unexpected error',
      notificationType: 'error',
      mockOnSubmit: jest.fn(),
    });

    fillForm(testInitials, testEmail, testPassword, true);

    await waitFor(() => expect(mockReset).not.toHaveBeenCalled());
  });
});
