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
    const { getByTestId } = render(<NotificationSuccess setIsOpen={mockSetIsOpen} />);
    expect(getByTestId('success-box')).toBeInTheDocument();
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

    expect(imgParent).toHaveStyle('top: 24.7rem');
  });
  test('uses correct translation key for success button', () => {
    render(<NotificationSuccess setIsOpen={() => {}} />);
    const button: HTMLElement = screen.getByRole('button');

    expect(button).toHaveTextContent(t('notifications.success.button'));
  });
});
