import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from 'i18next';

import NotificationError from '../../features/landing/components/Notification/NotificationError';

import { buttonRole } from './constants';

const retrySubmitButtonText: string = t('notifications.error.retry_button');
const backToFormButtonText: string = t('notifications.error.button');

const errorImgAltText: string = t('notifications.error.images.error');
const errorTitleText: string = t('notifications.error.title');
const errorDescription: string = t('notifications.error.description');

describe('NotificationError Component', () => {
  let mockSetIsOpen: jest.Mock;
  let mockRetrySubmit: jest.Mock;

  beforeEach(() => {
    mockSetIsOpen = jest.fn();
    mockRetrySubmit = jest.fn().mockResolvedValueOnce(undefined);
  });

  it('renders correctly', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    expect(screen.getByText(errorTitleText)).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: retrySubmitButtonText })).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: backToFormButtonText })).toBeInTheDocument();
  });

  it('calls retrySubmit when retry button is clicked', async () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const retryButton: HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText });
    await userEvent.click(retryButton);

    expect(mockRetrySubmit).toHaveBeenCalledTimes(1);
  });

  it('calls setIsOpen(false) when back-to-form button is clicked', async () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    await userEvent.click(backButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('renders images with correct alt text', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const errorImage: HTMLElement = screen.getByRole('img');
    expect(errorImage).toBeVisible();
    expect(errorImage).toHaveAttribute('alt', errorImgAltText);
  });

  it('renders the correct title and description', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    expect(screen.getByText(errorTitleText)).toBeInTheDocument();
    expect(screen.getByText(errorDescription)).toBeInTheDocument();
  });

  it('renders content box with correct styles', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const errorTitle: HTMLElement = screen.getByText(errorTitleText);
    const titleBox: HTMLElement | null = errorTitle.parentElement;
    const notificationBox: HTMLElement | null | undefined = titleBox?.parentElement;

    if (notificationBox) {
      const computedStyle: CSSStyleDeclaration = window.getComputedStyle(notificationBox);
      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.alignItems).toBe('center');
      expect(notificationBox).toHaveClass('MuiBox-root');
    }
  });
  it('applies correct styles to button text', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const backButtonText: HTMLElement = screen.getByText(backToFormButtonText);
    const computedStyle: CSSStyleDeclaration = window.getComputedStyle(backButtonText);

    expect(backButtonText).toBeInTheDocument();
    expect(computedStyle.fontWeight).toBe('500');
    expect(computedStyle.fontSize).toBe('0.9375rem');
    expect(computedStyle.lineHeight).toBe('1.125rem');
  });

  it('renders message container with correct styles', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const errorTitle: HTMLElement = screen.getByText(errorTitleText);

    expect(errorTitle).toBeInTheDocument();
    if (errorTitle.parentElement) {
      const computedStyle: CSSStyleDeclaration = window.getComputedStyle(errorTitle.parentElement);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.flexDirection).toBe('column');
    }
  });

  it('renders button text elements', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const retryButtonText: HTMLElement = screen.getByText(retrySubmitButtonText);
    const backButtonText: HTMLElement = screen.getByText(backToFormButtonText);

    expect(retryButtonText).toBeInTheDocument();
    expect(backButtonText).toBeInTheDocument();
  });
  it('renders the second button with correct marginTop', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    expect(backButton).toHaveStyle('marginTop: 0.5rem');
  });

  it('messageContainer should not have previous styles', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const errorBox: HTMLElement | null | undefined =
      screen.getByAltText(errorImgAltText)?.parentElement?.parentElement;

    expect(errorBox).toBeInTheDocument();

    expect(errorBox).not.toHaveClass('messageContainer');
    expect(errorBox).not.toHaveClass('messageContainerError');
  });

  it('button text should not have previous styles applied', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockRetrySubmit} />);

    const retryButton: HTMLElement = screen.getByText(retrySubmitButtonText);
    const backButton: HTMLElement = screen.getByText(backToFormButtonText);

    expect(retryButton).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();

    expect(window.getComputedStyle(retryButton).fontWeight).not.toBe('bold');
    expect(window.getComputedStyle(backButton).color).not.toBe('red');
  });
});
