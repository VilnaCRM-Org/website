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
  let routerMock: {
    pathname: string;
    asPath: string;
    push: jest.Mock;
    events: { on: jest.Mock; off: jest.Mock };
  };

  beforeEach(() => {
    routerMock = {
      pathname: '/',
      asPath: '/',
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    };
    (useRouter as jest.Mock).mockReturnValue(routerMock);
  });

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

  let routerMock: {
    pathname: string;
    asPath: string;
    push: jest.Mock;
    events: { on: jest.Mock; off: jest.Mock };
  };

  const originalLocation: Location = window.location;

  beforeEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { ...originalLocation, href: 'http://localhost:3000/' },
    });

    routerMock = {
      pathname: '/swagger',
      asPath: '/swagger',
      push: jest.fn().mockImplementation(async (url: string) => {
        routerMock.pathname = url;
        return Promise.resolve();
      }),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    };
    (useRouter as jest.Mock).mockReturnValue(routerMock);
    scrollToAnchorMock.mockClear();
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', {
      writable: true,
      value: originalLocation,
    });
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

    const testLocation: Location = window.location;

    type MutableWindow = Omit<Window, 'location'> & { location: Location };
    const mutableWindow: MutableWindow = window as unknown as MutableWindow;

    Object.defineProperty(mutableWindow, 'location', {
      value: { ...testLocation, href: testLocation.href },
      writable: true,
    });

    const { getByText } = render(<Header />);
    const target: NavItemProps = headerNavList[1];

    await user.click(getByText(t(target.title)));

    expect(mutableWindow.location.href.endsWith(`/${target.link}`)).toBe(true);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(scrollToAnchorMock).not.toHaveBeenCalled();
  });

  it('should register routeChangeComplete event listener on mount', () => {
    render(<Header />);

    expect(routerMock.events.on).toHaveBeenCalledWith('routeChangeComplete', expect.any(Function));
  });

  it('should unregister routeChangeComplete event listener on unmount', () => {
    const { unmount } = render(<Header />);

    unmount();

    expect(routerMock.events.off).toHaveBeenCalledWith('routeChangeComplete', expect.any(Function));
  });

  it('should scroll to anchor when URL contains hash on mount', () => {
    routerMock.asPath = '/swagger#Contacts';

    render(<Header />);

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Contacts');
  });

  it('should scroll to anchor when routeChangeComplete fires with hash in URL', () => {
    render(<Header />);

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];

    handleScroll('/swagger#Advantages');

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Advantages');
  });

  it('should not scroll when URL does not contain hash', () => {
    routerMock.asPath = '/swagger';

    render(<Header />);

    const callsBeforeMount: number = scrollToAnchorMock.mock.calls.length;

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];
    handleScroll('/swagger');

    expect(scrollToAnchorMock).toHaveBeenCalledTimes(callsBeforeMount);
  });
});
