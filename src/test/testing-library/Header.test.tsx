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

type RouterMock = {
  pathname: string;
  asPath: string;
  push: jest.Mock;
  events: { on: jest.Mock; off: jest.Mock };
};

describe('Header component', () => {
  let spy: jest.SpyInstance;
  let routerMock: RouterMock;

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

  it('renders logo link pointing to home with aria-label', () => {
    const { getByRole } = render(<Header />);
    const logoLink: HTMLElement = getByRole('link', { name: logoAlt });

    expect(logoLink).toHaveAttribute('href', '/');
    expect(logoLink).toHaveAttribute('aria-label', logoAlt);
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

  let routerMock: RouterMock;

  beforeEach(() => {
    window.history.pushState({}, 'Test Page', '/');

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

    type MutableWindow = Omit<Window, 'location'> & { location: Location };
    const mutableWindow: MutableWindow = window as unknown as MutableWindow;

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

  it('should extract correct hash ID from URL with multiple # characters', () => {
    render(<Header />);

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];

    // URL has multiple # characters, but only the first segment is extracted
    // Implementation splits by '#', takes [1] to get 'Section'
    handleScroll('/page#Section#subsection');

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Section');
  });

  it('should handle URL with hash at the end', () => {
    render(<Header />);

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];

    handleScroll('/page#');

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#');
  });

  it('should re-register event listener when router changes', () => {
    const { rerender } = render(<Header />);

    expect(routerMock.events.on).toHaveBeenCalledTimes(1);
    expect(routerMock.events.off).toHaveBeenCalledTimes(0);

    const newRouterMock: RouterMock = {
      pathname: '/',
      asPath: '/',
      push: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
      },
    };

    (useRouter as jest.Mock).mockReturnValue(newRouterMock);

    rerender(<Header />);

    expect(routerMock.events.off).toHaveBeenCalledTimes(1);
    expect(newRouterMock.events.on).toHaveBeenCalledTimes(1);
  });
});
