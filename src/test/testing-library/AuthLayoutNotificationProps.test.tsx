import type { NotificationControlProps } from '../../features/landing/components/notification/types';

import { renderWithProviders } from './utils';

const notificationSpy: jest.Mock = jest.fn();

jest.mock('../../features/landing/components/notification/notification', () => ({
  __esModule: true,
  default: (props: NotificationControlProps): null => {
    notificationSpy(props);
    return null;
  },
}));

describe('AuthLayout notification props', () => {
  beforeEach(() => {
    notificationSpy.mockClear();
  });

  it('passes empty errorText before any submission', async () => {
    const { default: AuthLayout } =
      await import('../../features/landing/components/auth-section/auth-form/auth-layout');
    renderWithProviders(<AuthLayout />);

    expect(notificationSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        errorText: '',
      })
    );
  });
});
