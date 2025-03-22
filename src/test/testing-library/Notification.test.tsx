import { render, RenderResult, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import { NotificationStatus } from '../../features/landing/components/AuthSection/AuthForm/types';
import Notification from '../../features/landing/components/Notification';
import { notificationComponents } from '../../features/landing/components/Notification/Notification';
import {
  NotificationControlProps,
  NotificationType,
} from '../../features/landing/components/Notification/types';

import { checkElementsInDocument, SetIsOpenType } from './utils';

const notificationBoxSelector: string = '.MuiBox-root';
const successTitleText: string = t('notifications.success.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');
const backToFormButton: string = t('notifications.error.button');
const retryButton: string = t('notifications.error.retry_button');

const buttonRole: string = 'button';

function renderNotification({
  type,
  isOpen,
  setIsOpen,
}: Omit<NotificationControlProps, 'retrySubmit'>): RenderResult {
  const retrySubmitMock: jest.Mock = jest.fn();
  return render(
    <Notification type={type} setIsOpen={setIsOpen} isOpen={isOpen} retrySubmit={retrySubmitMock} />
  );
}

describe('Notification', () => {
  let mockSetIsOpen: SetIsOpenType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetIsOpen = jest.fn();
  });

  it('renders notification success without crashing', () => {
    const { container, getByText, getByAltText, getAllByAltText, getByRole } = renderNotification({
      type: NotificationStatus.SUCCESS,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const notificationContainer: HTMLElement = container.querySelector(
      notificationBoxSelector
    ) as HTMLElement;
    const successConfettiImg: HTMLElement = getAllByAltText(confettiImgAltText)[0];
    const successConfettiImgBottom: HTMLElement = getAllByAltText(confettiImgAltText)[1];
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

    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  it('notificationComponents contains the error notification component', () => {
    expect(notificationComponents.error).toBeDefined();
    renderNotification({ type: NotificationStatus.ERROR, isOpen: true, setIsOpen: mockSetIsOpen });

    expect(screen.getByTestId('error-box')).toBeInTheDocument();
  });

  it('should use the correct component based on the "type" prop', () => {
    const type: NotificationType = NotificationStatus.SUCCESS;
    const setIsOpen: jest.Mock = jest.fn();
    const retrySubmit: jest.Mock = jest.fn();
    const isOpen: boolean = true;

    render(
      <Notification type={type} setIsOpen={setIsOpen} retrySubmit={retrySubmit} isOpen={isOpen} />
    );

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
  });

  it('should fallback to NotificationSuccess when no matching type is found', () => {
    const type: NotificationType = 'unknown';
    const setIsOpen: jest.Mock = jest.fn();
    const retrySubmit: jest.Mock = jest.fn();
    const isOpen: boolean = true;

    render(
      <Notification
        type={type as NotificationType}
        setIsOpen={setIsOpen}
        retrySubmit={retrySubmit}
        isOpen={isOpen}
      />
    );

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
  });
  it('renders "success" notification by default when type is empty', () => {
    renderNotification({ type: '', isOpen: false, setIsOpen: mockSetIsOpen });

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
        retrySubmit={retrySubmitMock}
      />
    );

    const button: HTMLElement = getByRole(buttonRole, { name: retryButton });

    await user.click(button);

    expect(retrySubmitMock).toHaveBeenCalled();
  });

  it('renders visible notification section', () => {
    const { getByTestId } = renderNotification({
      type: NotificationStatus.ERROR,
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const notification: Element | null = getByTestId('notification');

    expect(notification).toBeVisible();
    expect(notification).toHaveStyle('opacity: 1');
  });
  it('renders hidden notification section when not authenticated', () => {
    const { getByTestId } = renderNotification({
      type: NotificationStatus.ERROR,
      isOpen: false,
      setIsOpen: mockSetIsOpen,
    });
    const notification: Element | null = getByTestId('notification');

    expect(notification).not.toBeVisible();
    expect(notification).toHaveStyle('opacity: 0');
  });
});
