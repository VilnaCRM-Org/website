import { render, RenderResult, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React, { RefObject, useRef } from 'react';

import { CallableRef } from '../../features/landing/components/AuthSection/AuthForm/types';
import Notification from '../../features/landing/components/Notification';
import { notificationComponents } from '../../features/landing/components/Notification/Notification';
import { NotificationControlProps } from '../../features/landing/components/Notification/types';

import { checkElementsInDocument, SetIsOpenType } from './utils';

const notificationBoxSelector: string = '.MuiBox-root';
const successTitleText: string = t('notifications.success.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');
const backToFormButton: string = t('notifications.error.button');
const retryButton: string = t('notifications.error.retry_button');

const buttonRole: string = 'button';

type RenderNotificationProps = Omit<NotificationControlProps, 'triggerFormSubmit'>;

export function RenderNotification({
  type,
  isOpen,
  setIsOpen,
}: RenderNotificationProps): React.ReactElement {
  const formRef: RefObject<CallableRef> = useRef(null);

  const triggerFormSubmit: () => void = jest.fn(() => {
    if (formRef.current?.submit) {
      formRef.current.submit();
    }
  });
  return (
    <Notification
      type={type}
      setIsOpen={setIsOpen}
      isOpen={isOpen}
      triggerFormSubmit={triggerFormSubmit}
    />
  );
}

function renderNotification({ type, isOpen, setIsOpen }: RenderNotificationProps): RenderResult {
  return render(<RenderNotification type={type} isOpen={isOpen} setIsOpen={setIsOpen} />);
}

describe('Notification', () => {
  let mockSetIsOpen: SetIsOpenType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetIsOpen = jest.fn();
  });

  it('renders notification success without crashing', () => {
    const { container, getByText, getByAltText, getAllByAltText, getByRole } = renderNotification({
      type: 'success',
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
  test('notificationComponents contains the success notification component', () => {
    expect(notificationComponents.success).toBeDefined();

    renderNotification({ type: 'success', isOpen: true, setIsOpen: mockSetIsOpen });

    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  test('notificationComponents contains the error notification component', () => {
    expect(notificationComponents.error).toBeDefined();
    renderNotification({ type: 'error', isOpen: true, setIsOpen: mockSetIsOpen });

    expect(screen.getByTestId('error-box')).toBeInTheDocument();
  });

  test('check if the setIsOpen works properly on NotificationSuccess', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByRole } = renderNotification({
      type: 'success',
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const button: HTMLElement = getByRole(buttonRole);
    await user.click(button);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  test('check if the setIsOpen works properly on NotificationError', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByRole } = renderNotification({
      type: 'error',
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const button: HTMLElement = getByRole(buttonRole, { name: backToFormButton });

    await user.click(button);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  test('retry button works as expected', async () => {
    const user: UserEvent = userEvent.setup();
    const triggerFormSubmit: () => void = jest.fn();

    const { getByRole } = render(
      <Notification
        type="error"
        isOpen
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={triggerFormSubmit}
      />
    );

    const button: HTMLElement = getByRole(buttonRole, { name: retryButton });

    await user.click(button);

    expect(triggerFormSubmit).toHaveBeenCalled();
  });

  test('renders visible notification section', () => {
    const { getByTestId } = renderNotification({
      type: 'error',
      isOpen: true,
      setIsOpen: mockSetIsOpen,
    });

    const notification: Element | null = getByTestId('notification');

    expect(notification).toBeVisible();
    expect(notification).toHaveStyle('opacity: 1');
  });
  it('renders hidden notification section when not authenticated', () => {
    const { getByTestId } = renderNotification({
      type: 'error',
      isOpen: false,
      setIsOpen: mockSetIsOpen,
    });
    const notification: Element | null = getByTestId('notification');

    expect(notification).not.toBeVisible();
    expect(notification).toHaveStyle('opacity: 0');
  });
});
