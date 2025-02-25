// import { Box } from '@mui/material';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import { checkElementsInDocument } from '@/test/testing-library/utils';

import Notification from '../../features/landing/components/Notification';
import { notificationComponents } from '../../features/landing/components/Notification/Notification';
import NotificationSuccess from '../../features/landing/components/Notification/NotificationSuccess';
// import styles from '../../features/landing/components/Notification/styles';
import {
  // NotificationComponentsProps,
  // NotificationProps,
  NotificationType,
  // NotificationVariantComponent,
} from '../../features/landing/components/Notification/types';

const notificationBoxSelector: string = '.MuiBox-root';
const successTitleText: string = t('notifications.success.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');
const buttonText: string = t('notifications.success.button');

const buttonRole: string = 'button';

const mockSetIsOpen: jest.Mock<(isAuthenticated: boolean) => void> = jest.fn<
  (isAuthenticated: boolean) => void,
  [boolean]
>();

describe('Notification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification success without crashing', () => {
    const { container, getByText, getByAltText, getAllByAltText, getByRole } = render(
      <Notification type="success" setIsOpen={mockSetIsOpen} isOpen />
    );

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
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);
    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  test('renders NotificationSuccess only when type is success or unknown', () => {
    const { rerender } = render(<Notification type="success" setIsOpen={mockSetIsOpen} isOpen />);
    expect(screen.getByTestId('success-box')).toBeInTheDocument();

    rerender(
      <Notification type={'unknown' as NotificationType} setIsOpen={mockSetIsOpen} isOpen />
    );
    expect(screen.getByTestId('success-box')).toBeInTheDocument();

    rerender(
      <Notification type={'invalid' as NotificationType} setIsOpen={mockSetIsOpen} isOpen />
    );
    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  test('defaults to NotificationSuccess when type is unknown', () => {
    render(
      <Notification
        type={'unknown' as NotificationType} // Force a non-existent type
        setIsOpen={mockSetIsOpen}
        isOpen
      />
    );

    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  test('check if the setIsOpen works properly', async () => {
    const user: UserEvent = userEvent.setup();
    const { getByRole } = render(<Notification type="success" setIsOpen={mockSetIsOpen} isOpen />);

    const button: HTMLElement = getByRole(buttonRole);
    await user.click(button);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  test('renders visible notification section when authenticated', () => {
    const { getByTestId } = render(
      <Notification type="success" setIsOpen={mockSetIsOpen} isOpen />
    );

    const notification: Element | null = getByTestId('notification');

    expect(notification).toBeVisible();
    expect(notification).toHaveStyle('opacity: 1');
  });

  it('renders hidden notification section when not authenticated', () => {
    const { getByTestId } = render(
      <Notification type="success" setIsOpen={mockSetIsOpen} isOpen={false} />
    );

    const notification: Element | null = getByTestId('notification');

    expect(notification).not.toBeVisible();
    expect(notification).toHaveStyle('opacity: 0');
  });

  // it('renders SuccessNotification component based on the type prop', () => {
  //   const MockNotificationSuccess: React.FC<{ setIsOpen: (value: boolean) => void }> = jest.fn(
  //     () => <div data-testid="mock-success">Success</div>
  //   );
  //   const mockNotificationComponents: NotificationComponentsProps = {
  //     success: ({ setIsOpen }: Pick<NotificationProps, 'setIsOpen'>) => (
  //       <MockNotificationSuccess setIsOpen={setIsOpen} />
  //     ),
  //   };
  //
  //   const Component: NotificationVariantComponent = mockNotificationComponents.success;
  //   render(
  //     <Box sx={styles.notificationSection}>
  //       <Box sx={styles.notificationWrapper}>
  //         <Component setIsOpen={mockSetIsOpen} />
  //       </Box>
  //     </Box>
  //   );
  //
  //   expect(screen.getByText('Success')).toBeInTheDocument();
  // });
});

describe('NotificationSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders successfully', () => {
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);
    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  it('renders images with correct alt text', () => {
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);

    expect(screen.getByTestId('confetti')).toHaveAttribute('alt', confettiImgAltText);

    expect(screen.getByAltText(gearsImgAltText)).toBeInTheDocument();
  });

  it('renders the correct title and description', () => {
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);

    expect(screen.getByText(successTitleText)).toBeInTheDocument();
    expect(screen.getByText(successDescriptionText)).toBeInTheDocument();
  });

  it('renders the button with correct text and handles click event', () => {
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);

    const button: HTMLElement = screen.getByRole(buttonRole, { name: buttonText });

    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });

  it('renders images with right alts', () => {
    const { getAllByAltText, getByAltText } = render(
      <NotificationSuccess setIsOpen={mockSetIsOpen} />
    );

    const successConfettiImg: HTMLElement[] = getAllByAltText(confettiImgAltText);
    const successGearsImg: HTMLElement = getByAltText(gearsImgAltText);

    expect(successConfettiImg).toHaveLength(2);
    expect(successConfettiImg[0]).toHaveAttribute('alt', confettiImgAltText);
    expect(successConfettiImg[1]).toHaveAttribute('alt', confettiImgAltText);

    expect(successGearsImg).toHaveAttribute('alt', gearsImgAltText);
  });
  test('bottom image has correct styles for smaller screens', () => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(max-width: 640px)',
      addListener: jest.fn(),
      removeListener: jest.fn(),
    }));

    const { getAllByAltText } = render(<NotificationSuccess setIsOpen={jest.fn()} />);

    const successConfettiImgBottom: HTMLElement = getAllByAltText(confettiImgAltText)[1];
    const imgParent: HTMLElement | null = successConfettiImgBottom.parentElement;

    expect(imgParent).toHaveStyle('display: none');
  });
  test('uses correct translation key for success button', () => {
    render(<NotificationSuccess setIsOpen={() => {}} />);
    const button: HTMLElement = screen.getByRole('button');

    expect(button).toHaveTextContent(t('notifications.success.button'));
  });
});
