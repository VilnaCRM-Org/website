import {render, screen, fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from 'i18next';

import NotificationError from '../../features/landing/components/Notification/NotificationError';
import styles from '../../features/landing/components/Notification/styles';

import {backToFormButtonText, buttonRole, retrySubmitButtonText} from './constants';


const errorImgAltText: string = t('notifications.error.images.error');
export const errorTitle:string=t('notifications.error.title');
export const errorDescription:string=t('notifications.error.description');

describe('NotificationError Component', () => {
  let mockSetIsOpen: jest.Mock;
  let mockTriggerFormSubmit: jest.Mock;

  beforeEach(() => {
    mockSetIsOpen = jest.fn();
    mockTriggerFormSubmit = jest.fn();
  });

  test('renders correctly', () => {
    render(
      <NotificationError setIsOpen={mockSetIsOpen} triggerFormSubmit={mockTriggerFormSubmit} />
    );

    expect(screen.getByTestId('error-box')).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: retrySubmitButtonText  })).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: backToFormButtonText })).toBeInTheDocument();
  });

  test('calls triggerFormSubmit when retry button is clicked', () => {
    render(
      <NotificationError setIsOpen={mockSetIsOpen} triggerFormSubmit={mockTriggerFormSubmit} />
    );

    const retryButton: HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText });
    fireEvent.click(retryButton);

    expect(mockTriggerFormSubmit).toHaveBeenCalledTimes(1);
  });

  test('calls setIsOpen(false) when back-to-form button is clicked', () => {
    render(
      <NotificationError setIsOpen={mockSetIsOpen} triggerFormSubmit={mockTriggerFormSubmit} />
    );

    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    fireEvent.click(backButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('renders images with correct alt text', () => {
    render(
      <NotificationError setIsOpen={mockSetIsOpen} triggerFormSubmit={mockTriggerFormSubmit} />
    );

    expect(screen.getByTestId('error-image')).toHaveAttribute('alt', errorImgAltText);
  });

  it('renders the correct title and description', () => {
    render(
      <NotificationError setIsOpen={mockSetIsOpen} triggerFormSubmit={mockTriggerFormSubmit} />
    );

    expect(screen.getByText(errorTitle)).toBeInTheDocument();
    expect(screen.getByText(errorDescription)).toBeInTheDocument();
  });

  test('renders content box with correct styles', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const contentBox:HTMLElement = screen.getByTestId('error-box');
    const computedStyle:CSSStyleDeclaration = window.getComputedStyle(contentBox);
    expect(computedStyle.display).toBe('flex');
    expect(computedStyle.alignItems).toBe('center');
    expect(contentBox).toBeInTheDocument();
    expect(contentBox).toHaveClass('MuiBox-root');
  });
  test('applies correct styles to button text', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const backButtonText: HTMLElement = screen.getByText(backToFormButtonText);
    const computedStyle:CSSStyleDeclaration = window.getComputedStyle(backButtonText);

    expect(backButtonText).toBeInTheDocument();
    expect(computedStyle.fontWeight).toBe('500');
    expect(computedStyle.fontSize).toBe('15px');
    expect(computedStyle.lineHeight).toBe('18px');

  });

  test('renders message container with correct styles', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const messageContainer:HTMLElement = screen.getByTestId('error-message-container');
    const computedStyle:CSSStyleDeclaration = window.getComputedStyle(messageContainer);

    expect(computedStyle.display).toBe('flex');
    expect(computedStyle.flexDirection).toBe('column');
    expect(computedStyle.marginTop).toBe('0.8125rem');
    expect(messageContainer).toBeInTheDocument();
  });

  test('applies buttonTextStyle correctly', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const retryButtonText:HTMLElement = screen.getByText(backToFormButtonText);
    const backButtonText:HTMLElement = screen.getByText(retrySubmitButtonText);

    expect(retryButtonText).toBeInTheDocument();
    expect(backButtonText).toBeInTheDocument();
  });
  test('renders the second button with correct marginTop', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const backButton:HTMLElement =screen.getByRole(buttonRole, { name: backToFormButtonText });
    expect(backButton).toHaveStyle('marginTop: 0.5rem');
  });

  test('messageContainer should not have previous styles', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const messageContainer:HTMLElement = screen.getByTestId('error-box');

    expect(messageContainer).toBeInTheDocument();

    expect(messageContainer).not.toHaveClass('messageContainer');
    expect(messageContainer).not.toHaveClass('messageContainerError');
  });

  test('button text should not have previous styles applied', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const retryButton:HTMLElement = screen.getByText(retrySubmitButtonText);
    const backButton:HTMLElement = screen.getByText(backToFormButtonText);

    expect(retryButton).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();


    expect(retryButton).not.toHaveStyle(styles.messageButtonText);
    expect(retryButton).not.toHaveStyle(styles.errorButtonMessage);
    expect(backButton).not.toHaveStyle(styles.messageButtonText);
    expect(backButton).not.toHaveStyle(styles.errorButtonMessage);
  });

  test('buttons work as expected', async () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const retryButton:HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText});
    const backButton:HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });

    expect(retryButton).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();

    await userEvent.click(retryButton);
    expect(mockTriggerFormSubmit).toHaveBeenCalledTimes(1);

    await userEvent.click(backButton);
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);

  });

  test('button text does not have previous styles applied', () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const retryButtonText:HTMLElement = screen.getByText(retrySubmitButtonText);
    const backButtonText:HTMLElement = screen.getByText(backToFormButtonText);

    // Ensure buttons are in the document
    expect(retryButtonText).toBeInTheDocument();
    expect(backButtonText).toBeInTheDocument();

    expect(retryButtonText).not.toHaveStyle(styles.messageButtonText);
    expect(retryButtonText).not.toHaveStyle(styles.errorButtonMessage);
    expect(backButtonText).not.toHaveStyle(styles.messageButtonText);
    expect(backButtonText).not.toHaveStyle(styles.errorButtonMessage);
  });

  test('buttons still function correctly', async () => {
    render(
      <NotificationError
        setIsOpen={mockSetIsOpen}
        triggerFormSubmit={mockTriggerFormSubmit}
      />
    );

    const retryButton:HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText});
    const backButton:HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });

    await userEvent.click(retryButton);
    expect(mockTriggerFormSubmit).toHaveBeenCalled();

    await userEvent.click(backButton);
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
});
