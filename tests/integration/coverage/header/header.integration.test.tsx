import { render } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import i18next, { t } from 'i18next';
import { useRouter } from 'next/router';

import { headerNavList } from '@components/Header/constants';
import Header from '@components/Header/Header';

import fallbackNavigate from '../../../../src/features/landing/helpers/fallbackNavigate';
import scrollToAnchor from '../../../../src/features/landing/helpers/scrollToAnchor';
import { NavItemProps } from '../../../../src/features/landing/types/header/navigation';

const logoAltKey: string = 'header.logo_alt';
const logoAlt: string = i18next.t(logoAltKey);

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

jest.mock('../../../../src/features/landing/helpers/scrollToAnchor', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../../src/features/landing/helpers/fallbackNavigate', () => ({
  __esModule: true,
  default: jest.fn(),
}));

const scrollToAnchorMock: jest.MockedFunction<typeof scrollToAnchor> =
  scrollToAnchor as jest.MockedFunction<typeof scrollToAnchor>;
const fallbackNavigateMock: jest.MockedFunction<typeof fallbackNavigate> =
  fallbackNavigate as jest.MockedFunction<typeof fallbackNavigate>;

type RouterMock = {
  pathname: string;
  asPath: string;
  push: jest.Mock;
  events: { on: jest.Mock; off: jest.Mock };
};

describe('integration: Header render', () => {
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

describe('integration: Header navigation', () => {
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

  it('scrolls to the correct link on the swagger page (contacts branch)', async () => {
    const { getByText } = render(<Header />);
    await user.click(getByText(t('header.contacts')));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.pathname).toBe('/swagger');
    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Contacts');
    expect(scrollToAnchorMock).toHaveBeenCalledTimes(1);
  });

  it('pushes to home then scrolls when not on home page', async () => {
    const { getByText } = render(<Header />);
    const targetElement: NavItemProps = headerNavList[1];
    const { link } = targetElement;

    await user.click(getByText(t(targetElement.title)));

    expect(routerMock.push).toHaveBeenCalledWith(`/${link}`, undefined, { scroll: true });
    expect(routerMock.pathname).toBe(`/${link}`);
    expect(scrollToAnchorMock).toHaveBeenCalledWith(link);
    expect(scrollToAnchorMock).toHaveBeenCalledTimes(1);
  });

  it('scrolls directly when already on the home page', async () => {
    routerMock.pathname = '/';

    const { getByText } = render(<Header />);
    const targetElement: NavItemProps = headerNavList[1];
    const { link } = targetElement;

    await user.click(getByText(t(targetElement.title)));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.pathname).toBe('/');
    expect(scrollToAnchorMock).toHaveBeenCalledWith(link);
  });

  it('falls back to window navigation when router.push fails', async () => {
    routerMock.push.mockRejectedValueOnce(new Error('push failed'));

    const { getByText } = render(<Header />);
    const target: NavItemProps = headerNavList[1];

    await user.click(getByText(t(target.title)));

    expect(fallbackNavigateMock).toHaveBeenCalledWith(`/${target.link}`);
    expect(routerMock.push).toHaveBeenCalledTimes(1);
    expect(scrollToAnchorMock).not.toHaveBeenCalled();
  });

  it('registers routeChangeComplete listener on mount', () => {
    render(<Header />);

    expect(routerMock.events.on).toHaveBeenCalledWith('routeChangeComplete', expect.any(Function));
  });

  it('unregisters routeChangeComplete listener on unmount', () => {
    const { unmount } = render(<Header />);

    unmount();

    expect(routerMock.events.off).toHaveBeenCalledWith('routeChangeComplete', expect.any(Function));
  });

  it('scrolls to anchor when initial URL contains a hash', () => {
    routerMock.asPath = '/swagger#Contacts';

    render(<Header />);

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Contacts');
  });

  it('scrolls to anchor when routeChangeComplete fires with a hash', () => {
    render(<Header />);

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];
    handleScroll('/swagger#Advantages');

    expect(scrollToAnchorMock).toHaveBeenCalledWith('#Advantages');
  });

  it('does not scroll when URL has no hash', () => {
    routerMock.asPath = '/swagger';

    render(<Header />);

    const callsBeforeMount: number = scrollToAnchorMock.mock.calls.length;

    const handleScroll: (url: string) => void = routerMock.events.on.mock.calls[0][1];
    handleScroll('/swagger');

    expect(scrollToAnchorMock).toHaveBeenCalledTimes(callsBeforeMount);
  });

  it('re-registers the listener when the router changes', () => {
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
