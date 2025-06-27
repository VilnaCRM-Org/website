import { render } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import i18next, { t } from 'i18next';
import { useRouter } from 'next/router';

import { headerNavList } from '../../features/landing/components/Header/constants';
import Header from '../../features/landing/components/Header/Header';
import scrollToAnchor from '../../features/landing/helpers/scrollToAnchor';
import { NavItemProps } from '../../features/landing/types/header/navigation';

const logoAltKey: string = 'header.logo_alt';
const logoAlt: string = i18next.t(logoAltKey);

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

describe('Header component', () => {
  let spy: jest.SpyInstance;

  afterEach(() => {
    if (spy) {
      spy.mockRestore();
    }
  });

  it('uses correct translation key for logo alt text', () => {
    spy = jest.spyOn(i18next, 't');
    render(<Header />);
    expect(spy).toHaveBeenCalled();
    expect(spy.mock.calls).toContainEqual([logoAltKey, expect.anything()]);
  });

  it('renders logo', () => {
    const { getByAltText } = render(<Header />);
    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });
});

jest.mock('../../features/landing/helpers/scrollToAnchor', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const scrollToAnchorMock: jest.MockedFunction<typeof scrollToAnchor> =
  scrollToAnchor as jest.MockedFunction<typeof scrollToAnchor>;

describe('Header navigation', () => {
  const user: UserEvent = userEvent.setup();

  let routerMock: { pathname: string; push: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();

    routerMock = {
      pathname: '/swagger',
      push: jest.fn().mockImplementation(async (url: string) => {
        routerMock.pathname = url;
        return Promise.resolve();
      }),
    };
    (useRouter as jest.Mock).mockReturnValue(routerMock);
  });

  it('should scroll to the correct link on the swagger page', async () => {
    const { getByText } = render(<Header />);
    await user.click(getByText(t('header.contacts')));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.pathname).toBe('/swagger');
    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Contacts');
    expect(scrollToAnchorMock).toHaveBeenCalledTimes(1);
  });
  it('should scroll to the correct link and change page to home', async () => {
    const { getByText } = render(<Header />);
    const targetElement: NavItemProps = headerNavList[1];
    const { link } = targetElement;

    await user.click(getByText(t(targetElement.title)));

    expect(routerMock.push).toHaveBeenCalledWith(`/${link}`, undefined, { scroll: true });

    expect(routerMock.pathname).toBe(`/${link}`);
    expect(scrollToAnchorMock).toHaveBeenCalledWith(link);
    expect(scrollToAnchorMock).toHaveBeenCalledTimes(1);
  });
  it('should scroll to the correct link on the Home page', async () => {
    routerMock.pathname = '/';

    const { getByText } = render(<Header />);
    const targetElement: NavItemProps = headerNavList[1];
    const { link } = targetElement;

    await user.click(getByText(t(targetElement.title)));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.pathname).toBe('/');
    expect(scrollToAnchorMock).toHaveBeenCalledWith(link);
  });
  it('falls back to window.location.href when router.push fails', async () => {
    routerMock.push.mockRejectedValueOnce(new Error('push failed'));

    const originalLocation: Location = window.location;

    type MutableWindow = Omit<Window, 'location'> & { location: Location };
    const mutableWindow: MutableWindow = window as unknown as MutableWindow;

    Object.defineProperty(mutableWindow, 'location', {
      value: { ...originalLocation, href: originalLocation.href },
      writable: true,
    });

    const { getByText } = render(<Header />);
    const target: NavItemProps = headerNavList[1];

    await user.click(getByText(t(target.title)));

    expect(mutableWindow.location.href.endsWith(`/${target.link}`)).toBe(true);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(scrollToAnchorMock).not.toHaveBeenCalled();

    expect(scrollToAnchorMock).not.toHaveBeenCalled();
  });
});
