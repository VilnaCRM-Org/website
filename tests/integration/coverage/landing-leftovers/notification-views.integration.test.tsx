/**
 * Integration coverage: the Notification view switch and its success/error
 * sub-components, including the action handlers and the unknown-type fallback —
 * branches the happy-path registration flow does not reach.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { t } from 'i18next';

import Notification, {
  notificationComponents,
} from '../../../../src/features/landing/components/Notification/Notification';
import { NotificationStatus } from '../../../../src/features/landing/components/Notification/types';

describe('integration: notification views', () => {
  it('maps each notification status to a view component', () => {
    expect(notificationComponents[NotificationStatus.SUCCESS]).toBeDefined();
    expect(notificationComponents[NotificationStatus.ERROR]).toBeDefined();
  });

  it('renders the success view and closes on its action button', () => {
    const setIsOpen = jest.fn();

    render(
      <Notification
        type={NotificationStatus.SUCCESS}
        isOpen
        setIsOpen={setIsOpen}
        onRetry={jest.fn()}
        loading={false}
        errorText=""
      />
    );

    expect(screen.getByText(t('notifications.success.title'))).toBeInTheDocument();
    fireEvent.click(screen.getByText(t('notifications.success.button')));
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it('renders the error view and wires the retry and close actions', () => {
    const setIsOpen = jest.fn();
    const onRetry = jest.fn();

    render(
      <Notification
        type={NotificationStatus.ERROR}
        isOpen
        setIsOpen={setIsOpen}
        onRetry={onRetry}
        loading={false}
        errorText="Boom"
      />
    );

    expect(screen.getByText(t('notifications.error.title'))).toBeInTheDocument();
    expect(screen.getByText('Boom')).toBeInTheDocument();

    fireEvent.click(screen.getByText(t('notifications.error.retry_button')));
    expect(onRetry).toHaveBeenCalled();

    fireEvent.click(screen.getByText(t('notifications.error.button')));
    expect(setIsOpen).toHaveBeenCalledWith(false);
  });

  it('falls back to the error view (and default message) for an unknown type', () => {
    render(
      <Notification
        type={'unknown' as unknown as NotificationStatus}
        isOpen
        setIsOpen={jest.fn()}
        onRetry={jest.fn()}
        loading={false}
        errorText=""
      />
    );

    expect(screen.getByText(t('notifications.error.title'))).toBeInTheDocument();
    expect(
      screen.getByText(t('failure_responses.client_errors.something_went_wrong'))
    ).toBeInTheDocument();
  });
});
