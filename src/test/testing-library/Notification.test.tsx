import { render, RenderResult, screen, waitFor } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import Notification from '../../features/landing/components/Notification';
import { notificationComponents } from '../../features/landing/components/Notification/Notification';
import {
  NotificationControlProps,
  NotificationStatus,
} from '../../features/landing/components/Notification/types';

import { buttonRole } from './constants';
import { checkElementsInDocument, SetIsOpenType } from './utils';

const successTitleText: string = t('notifications.success.title');
const errorTitleText: string = t('notifications.error.title');
const fallbackTitleText: string = t('notifications.unknown.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');
const backToFormButton: string = t('notifications.error.button');
const retryButton: string = t('notifications.error.retry_button');

function renderNotification({
  type,
  isOpen,
  setIsOpen,
  onRetry = jest.fn(),
}: Partial<NotificationControlProps> & {
  setIsOpen: NotificationControlProps['setIsOpen'];
}): RenderResult {
  return render(
    <Notification
      type={type || NotificationStatus.SUCCESS}
      setIsOpen={setIsOpen}
      isOpen={isOpen || false}
      onRetry={onRetry}
    />
  );
}

describe('Notification', () => {
  let mockSetIsOpen: SetIsOpenType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetIsOpen = jest.fn();
  });

  it('renders notification success without crashing', () => {
    const { getByText, getByAltText, getByRole } = renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const notificationContainer: HTMLElement = getByRole('alert');
    const successConfettiImg: HTMLElement = getByAltText(confettiImgAltText);
    const successConfettiImgBottom: HTMLElement = getByAltText('');
    const successGearsImg: HTMLElement = getByAltText(gearsImgAltText);
    const successTitle: HTMLElement = getByText(successTitleText);
    const successDescription: HTMLElement = getByText(successDescriptionText);
    const button: HTMLElement = getByRole(buttonRole);

    checkElementsInDocument(
      notificationContainer,
      successConfettiImg,
      successConfettiImgBottom,
      successGearsImg,
      successTitle,
      successDescription,
      button
    );
  });
  it('notificationComponents contains the success notification component', () => {
    expect(notificationComponents.success).toBeDefined();

    renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
  });

  it('notificationComponents contains the error notification component', () => {
    expect(notificationComponents.error).toBeDefined();
    renderNotification({ type: NotificationStatus.ERROR, isOpen: true, setIsOpen: mockSetIsOpen });

    expect(screen.getByText(errorTitleText)).toBeInTheDocument();
  });

  it('should use the correct component based on the "type" prop', () => {
    const type: NotificationStatus = NotificationStatus.SUCCESS;
    const setIsOpen: jest.Mock = jest.fn();
    const retrySubmit: jest.Mock = jest.fn();
    const isOpen: boolean = true;

    render(
      <Notification type={type} setIsOpen={setIsOpen} onRetry={retrySubmit} isOpen={isOpen} />
    );

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
  });

  it('should fallback to NotificationSuccess when no matching type is found', () => {
    const type: NotificationStatus = 'unknown' as NotificationStatus;
    const setIsOpen: jest.Mock = jest.fn();
    const retrySubmit: jest.Mock = jest.fn();
    const isOpen: boolean = true;

    render(
      <Notification type={type} setIsOpen={setIsOpen} onRetry={retrySubmit} isOpen={isOpen} />
    );

    const fallbackComponent: HTMLElement = screen.getByText(fallbackTitleText);

    expect(fallbackComponent).toBeInTheDocument();
    expect(fallbackComponent).toHaveRole('alert');
  });
  it('renders "success" notification by default when type is empty', () => {
    renderNotification({ type: '' as NotificationStatus, isOpen: false, setIsOpen: mockSetIsOpen });

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
  });
  it('check if the setIsOpen works properly on NotificationSuccess', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByRole } = renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const button: HTMLElement = getByRole(buttonRole);
    await user.click(button);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('check if the setIsOpen works properly on NotificationError', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByRole } = renderNotification({
      type: NotificationStatus.ERROR,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const button: HTMLElement = getByRole(buttonRole, { name: backToFormButton });

    await user.click(button);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('retry button works as expected', async () => {
    const user: UserEvent = userEvent.setup();
    const retrySubmitMock: jest.Mock = jest.fn();

    const { getByRole } = render(
      <Notification
        type={NotificationStatus.ERROR}
        isOpen
        setIsOpen={mockSetIsOpen}
        onRetry={retrySubmitMock}
      />
    );

    const button: HTMLElement = getByRole(buttonRole, { name: retryButton });

    await user.click(button);

    expect(retrySubmitMock).toHaveBeenCalled();
    expect(retrySubmitMock).toHaveBeenCalledTimes(1);

    expect(mockSetIsOpen).not.toHaveBeenCalled();
    expect(button).toBeVisible();
    expect(button).toBeEnabled();
  });

  it('renders visible notification section', () => {
    const { getByRole } = renderNotification({
      type: NotificationStatus.ERROR,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const errorImage: HTMLElement = getByRole('img');
    const generalNotificationBox: Element | null | undefined =
      errorImage.parentElement?.parentElement?.parentElement;

    expect(generalNotificationBox).toBeVisible();
    expect(generalNotificationBox).toHaveStyle('opacity: 1');
  });
  it('should handle keyboard navigation', async () => {
    const user: UserEvent = userEvent.setup();

    const { getByRole } = renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    expect(getByRole(buttonRole)).toBeInTheDocument();

    await waitFor(() => user.tab());

    const button: HTMLElement = getByRole(buttonRole);

    expect(button).toHaveFocus();

    await user.keyboard('{Enter}');

    expect(mockSetIsOpen).toHaveBeenCalledTimes(1);
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('has proper aria attributes for accessibility', () => {
    const { getByRole } = renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const button: HTMLElement = getByRole(buttonRole);
    expect(button).toHaveAttribute('type', 'button');

    const images: HTMLElement[] = screen.getAllByRole('img');
    images.forEach(img => {
      expect(img).toHaveAttribute('alt');
    });
  });
});
