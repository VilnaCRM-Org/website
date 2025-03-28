import { render, screen } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
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
  let mockOnRetry: jest.Mock;

  beforeEach(() => {
    mockSetIsOpen = jest.fn();
    mockOnRetry = jest.fn().mockResolvedValueOnce(undefined);
  });

  it('renders correctly', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    expect(screen.getByText(errorTitleText)).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: retrySubmitButtonText })).toBeInTheDocument();
    expect(screen.getByRole(buttonRole, { name: backToFormButtonText })).toBeInTheDocument();
  });

  it('calls retrySubmit when retry button is clicked', async () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const retryButton: HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText });
    await userEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
  });

  it('calls setIsOpen(false) when back-to-form button is clicked', async () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    await userEvent.click(backButton);

    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
  it('renders images with correct alt text', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const errorImage: HTMLElement = screen.getByRole('img');
    expect(errorImage).toBeVisible();
    expect(errorImage).toHaveAttribute('alt', errorImgAltText);
  });

  it('renders the correct title and description', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    expect(screen.getByText(errorTitleText)).toBeInTheDocument();
    expect(screen.getByText(errorDescription)).toBeInTheDocument();
  });

  it('renders content box with correct styles', () => {
    const { container } = render(
      <NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />
    );

    const errorBox: HTMLElement | null = container.querySelector('[aria-live="polite"]');

    if (errorBox) {
      const computedStyle: CSSStyleDeclaration = window.getComputedStyle(errorBox);
      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.alignItems).toBe('center');
      expect(errorBox).toBeVisible();
      expect(errorBox).toHaveClass('MuiBox-root');
    }
  });
  it('applies correct styles to button text', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const backButtonText: HTMLElement = screen.getByText(backToFormButtonText);
    const computedStyle: CSSStyleDeclaration = window.getComputedStyle(backButtonText);

    expect(computedStyle.fontWeight).toBe('500');
    expect(computedStyle.fontSize).toBe('0.9375rem');
    expect(computedStyle.lineHeight).toBe('1.125rem');
  });

  it('renders message container with correct styles', () => {
    const { container, getByText } = render(
      <NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />
    );
    const errorBox: HTMLElement | null = container.querySelector('[aria-live="polite"]');
    const errorTitle: HTMLElement = getByText(errorTitleText);

    expect(errorTitle).toBeInTheDocument();
    if (errorBox) {
      const computedStyle: CSSStyleDeclaration = window.getComputedStyle(errorBox);

      expect(computedStyle.display).toBe('flex');
      expect(computedStyle.flexDirection).toBe('column');
    }
  });

  it('renders button text elements', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const retryButtonText: HTMLElement = screen.getByText(retrySubmitButtonText);
    const backButtonText: HTMLElement = screen.getByText(backToFormButtonText);

    expect(retryButtonText).toBeInTheDocument();
    expect(backButtonText).toBeInTheDocument();
  });
  it('renders the second button with correct marginTop', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    expect(backButton).toHaveStyle('marginTop: 0.5rem');
  });

  it('messageContainer should not have previous styles', () => {
    const { container } = render(
      <NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />
    );

    const errorBox: HTMLElement | null = container.querySelector('[aria-invalid="true"]');

    expect(errorBox).toBeInTheDocument();

    expect(errorBox).not.toHaveClass('messageContainer');
    expect(errorBox).not.toHaveClass('messageContainerError');
  });

  it('button text should not have previous styles applied', () => {
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    const retryButton: HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText });
    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });

    expect(retryButton).toBeInTheDocument();
    expect(backButton).toBeInTheDocument();

    expect(window.getComputedStyle(retryButton).fontWeight).not.toBe('bold');
    expect(window.getComputedStyle(backButton).color).not.toBe('red');
  });
  it('supports keyboard navigation', async () => {
    const user: UserEvent = userEvent.setup();
    render(<NotificationError setIsOpen={mockSetIsOpen} onRetry={mockOnRetry} />);

    await user.tab();
    const retryButton: HTMLElement = screen.getByRole(buttonRole, { name: retrySubmitButtonText });
    expect(retryButton).toHaveFocus();

    await user.tab();
    const backButton: HTMLElement = screen.getByRole(buttonRole, { name: backToFormButtonText });
    expect(backButton).toHaveFocus();

    await user.keyboard('{Enter}');
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
});
