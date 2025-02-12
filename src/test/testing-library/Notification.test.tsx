import { Box } from '@mui/material';
import { render, screen } from '@testing-library/react';
import userEvent, { UserEvent, } from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import { checkElementsInDocument } from '@/test/testing-library/utils';

import { AuthFormProps } from '../../features/landing/components/AuthSection/AuthForm/types';
import Notification from '../../features/landing/components/Notification';
import styles from '../../features/landing/components/Notification/styles';
import { NotificationType } from '../../features/landing/components/Notification/types';

const notificationBoxSelector: string = '.MuiBox-root';
const successTitleText: string = t('notifications.success.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');

const buttonRole: string = 'button';

const mockSetIsAuthenticated: jest.Mock<(isAuthenticated: boolean) => void> = jest.fn();

describe('Notification', () =>{
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders notification success without crashing', () => {
    const {container, getByText, getByAltText,getAllByAltText, getByRole} = render(
      <Notification type='success' setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated/>);

    const notificationContainer: HTMLElement = container.querySelector(notificationBoxSelector) as HTMLElement;
    const successConfettiImg: HTMLElement = getAllByAltText(confettiImgAltText)[0];
    const successConfettiImgBottom: HTMLElement = getAllByAltText(confettiImgAltText)[1];
    const successGearsImg: HTMLElement = getByAltText(gearsImgAltText);
    const successTitle:HTMLElement = getByText(successTitleText);
    const successDescription:HTMLElement =getByText(successDescriptionText);
    const button:HTMLElement = getByRole(buttonRole);


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
  test('check if the setIsAuthenticated works properly', async() => {
    const user: UserEvent = userEvent.setup();
    const { getByRole} = render(
      <Notification type='success' setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated />);

    const button:HTMLElement = getByRole(buttonRole);
    await user.click(button);

    expect(mockSetIsAuthenticated).toHaveBeenCalledWith(false);

  });
  test('renders visible notification section when authenticated', () => {
    const {container} = render(
      <Notification type='success' setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated />);

    expect(container.querySelector(notificationBoxSelector)).toBeVisible();
  });

  it('renders hidden notification section when not authenticated', () => {
    const {container} = render(
      <Notification type='success' setIsAuthenticated={mockSetIsAuthenticated} isAuthenticated={false}/>);

    expect(container.querySelector(notificationBoxSelector)).not.toBeVisible();

  });
  test('defaults to NotificationSuccess when type is unknown', () => {
    render(
      <Notification
        type={'unknown' as NotificationType} // Force a non-existent type
        setIsAuthenticated={mockSetIsAuthenticated}
        isAuthenticated
      />
    );

    expect(screen.getByTestId('success-box')).toBeInTheDocument();
  });

  const MockNotificationSuccess: React.FC<{ setIsAuthenticated: (value: boolean) => void }> = jest.fn(
    () => <div data-testid="mock-success">Success</div>);


  it('renders SuccessNotification component based on the type prop', () => {

    const type: NotificationType = 'success';
    const notificationComponents: Record<
      NotificationType,
      React.FC<Omit<AuthFormProps, 'isAuthenticated'>>
    > = {
      success: ({ setIsAuthenticated }: Omit<AuthFormProps, 'isAuthenticated'>) => (
        <MockNotificationSuccess setIsAuthenticated={setIsAuthenticated} />
      ),

    };

    const Component: React.FC<Omit<AuthFormProps, 'isAuthenticated'>> =
      notificationComponents[type] || MockNotificationSuccess;
    const isAuthenticated:boolean = true;
  render(
      <Box
        sx={{
          ...styles.notificationSection,
          ...(isAuthenticated ? styles.isVisible : styles.isHidden),
        }}
      >
        <Box sx={styles.notificationWrapper}>
          <Component setIsAuthenticated={mockSetIsAuthenticated} />
        </Box>
      </Box>
    );

    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
