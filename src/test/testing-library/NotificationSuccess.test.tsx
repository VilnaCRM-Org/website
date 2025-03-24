import { fireEvent, render, screen } from '@testing-library/react';
import { t } from 'i18next';

import { buttonRole } from '@/test/testing-library/constants';

import NotificationSuccess from '../../features/landing/components/Notification/NotificationSuccess';

import { SetIsOpenType } from './utils';

const successTitleText: string = t('notifications.success.title');
const successDescriptionText: string = t('notifications.success.description');
const confettiImgAltText: string = t('notifications.success.images.confetti');
const gearsImgAltText: string = t('notifications.success.images.gears');
const buttonText: string = t('notifications.success.button');

describe('NotificationSuccess ', () => {
  let mockSetIsOpen: SetIsOpenType;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSetIsOpen = jest.fn();
  });

  it('renders NotificationSuccess successfully', () => {
    const { getAllByAltText } = render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);
    const confettiImages: HTMLElement[] = getAllByAltText(confettiImgAltText);
    const successBox: HTMLElement | null | undefined =
      confettiImages[0].parentElement?.parentElement;

    expect(successBox).toBeInTheDocument();
  });

  it('renders images with correct alt text', () => {
    render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);

    const images: HTMLElement[] = screen.getAllByRole('img');
    expect(images).toHaveLength(3);

    images.forEach((image: HTMLElement) => {
      expect(image).toBeInTheDocument();
      expect(image).toBeVisible();
    });

    expect(images[0]).toHaveAttribute('alt', confettiImgAltText);
    expect(images[1]).toHaveAttribute('alt', gearsImgAltText);
    expect(images[2]).toHaveAttribute('alt', confettiImgAltText);
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

  it('bottom image has correct styles for smaller screens', () => {
    window.matchMedia = jest.fn().mockImplementation(query => ({
      matches: query === '(max-width: 640px)',
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));

    const { getAllByAltText } = render(<NotificationSuccess setIsOpen={jest.fn()} />);

    const successConfettiImgBottom: HTMLElement = getAllByAltText(confettiImgAltText)[1];
    const imgParent: HTMLElement | null = successConfettiImgBottom.parentElement;

    expect(imgParent).toHaveStyle('bottom: -0.78rem');
  });
  it('uses correct translation key for success button', () => {
    render(<NotificationSuccess setIsOpen={() => {}} />);
    const button: HTMLElement = screen.getByRole('button');

    expect(button).toHaveTextContent(t('notifications.success.button'));
  });
});
