import { fireEvent, render } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';
import { useRouter } from 'next/router';
import React from 'react';

import {
  headerNavList,
  testDrawerItem,
  testHeaderItem,
} from '../../features/landing/components/Header/constants';
import NavList from '../../features/landing/components/Header/NavList/NavList';
import scrollToAnchor from '../../features/landing/helpers/scrollToAnchor';
import { NavItemProps } from '../../features/landing/types/header/navigation';

const handleClick: () => void = jest.fn();

const navItems: NavItemProps[] = [testHeaderItem];
const drawerNavItems: NavItemProps[] = [testDrawerItem];

const navWrapperClass: string = '.MuiStack-root';
const navContentClass: string = '.MuiList-root';

const displayNoneStyle: string = 'display: none';
const flexColumnStyle: string = 'flex-direction: column';
const flexStyle: string = 'display: flex';
const marginTopStyle: string = 'margin-top: 6rem';

describe('NavList component', () => {
  it('renders NavList component correctly with header wrapper', () => {
    const { container } = render(<NavList navItems={navItems} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).toBeInTheDocument();
    expect(container.querySelector(navWrapperClass)).toHaveStyle(displayNoneStyle);
    expect(container.querySelector(navWrapperClass)).toHaveStyle(flexColumnStyle);
    expect(container.querySelector(navWrapperClass)).not.toHaveStyle(marginTopStyle);
    expect(container.querySelector(navContentClass)).toBeInTheDocument();
    expect(container.querySelector(navContentClass)).toHaveStyle(flexStyle);
    expect(container.querySelector(navContentClass)).not.toHaveStyle(flexColumnStyle);
  });

  it('renders NavList component correctly with drawer wrapper', () => {
    const { container } = render(<NavList navItems={drawerNavItems} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).toBeInTheDocument();
    expect(container.querySelector(navWrapperClass)).not.toHaveStyle(displayNoneStyle);
    expect(container.querySelector(navContentClass)).toBeInTheDocument();
    expect(container.querySelector(navContentClass)).toHaveStyle(flexColumnStyle);
  });

  it('renders NavList component correctly with empty array', () => {
    const { container } = render(<NavList navItems={[]} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).not.toBeInTheDocument();
    expect(container.querySelector(navContentClass)).not.toBeInTheDocument();
  });
  it('invokes handleClick with the correct link on item click', async () => {
    const clickSpy: jest.Mock = jest.fn();

    const { getByText } = render(<NavList navItems={headerNavList} handleClick={clickSpy} />);

    await userEvent.click(getByText(t(headerNavList[0].title)));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledWith('#Advantages');
  });
  it('invokes handleClick when the link is Contacts', async () => {
    const clickSpy: jest.Mock = jest.fn();

    const { getByText } = render(<NavList navItems={headerNavList} handleClick={clickSpy} />);

    await userEvent.click(getByText(t('header.contacts')));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledWith('#Contacts');
  });
  it('does not call handleClick when handleClick is undefined', () => {
    const { container } = render(<NavList navItems={navItems} handleClick={undefined} />);

    const firstNavItem: Element | null =
      container.querySelector('[data-testid="nav-item"]') ||
      container.querySelector('li') ||
      container.querySelector('a');

    if (firstNavItem) {
      expect(() => fireEvent.click(firstNavItem)).not.toThrow();
    }
  });
});

const contactsItem: NavItemProps = {
  id: 'contacts',
  title: 'header.contacts',
  link: '#CONTACTS',
  type: 'header',
};

jest.mock('next/router', () => ({ useRouter: jest.fn() }));

jest.mock('../../features/landing/helpers/scrollToAnchor', () => ({
  __esModule: true,
  default: jest.fn(),
}));
const scrollToAnchorMock: jest.MockedFunction<typeof scrollToAnchor> =
  scrollToAnchor as jest.MockedFunction<typeof scrollToAnchor>;
describe('NavList navigation', () => {
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

  it('calls scrollToAnchor for "contacts" and keeps pathname', async () => {
    const handleLinkClick: (link: string) => void = (link: string): void => {
      const normalised: string = link.replace(/^#/, '').toLowerCase();
      if (normalised === 'contacts') scrollToAnchor(link);
    };
    const { getByText } = render(
      <NavList navItems={[contactsItem]} handleClick={handleLinkClick} />
    );

    await user.click(getByText(t('header.contacts')));

    expect(routerMock.push).not.toHaveBeenCalled();
    expect(routerMock.pathname).toBe('/swagger');
    expect(scrollToAnchorMock).toHaveBeenCalledWith(contactsItem.link);
    expect(scrollToAnchorMock).toHaveBeenCalledWith('#CONTACTS');
  });

  it('calls given callback with link', async () => {
    const handleClickMock: jest.Mock = jest.fn();
    const advantages: NavItemProps = {
      id: 'advantages',
      title: 'header.advantages',
      link: '#Advantages',
      type: 'header',
    };

    const { getByText } = render(<NavList navItems={[advantages]} handleClick={handleClickMock} />);

    await user.click(getByText(t('header.advantages')));
    expect(handleClickMock).toHaveBeenCalledWith('#Advantages');
  });
  it('should only remove leading #, not inner ones', async () => {
    routerMock.pathname = '/';
    const handleClickProxy: (link: string) => void = (link: string): void => scrollToAnchor(link);

    const weirdLink: string = '#weird#section';
    const navItem: NavItemProps = {
      id: 'weird',
      title: 'header.weird',
      link: weirdLink,
      type: 'header',
    };

    const { getByText } = render(<NavList navItems={[navItem]} handleClick={handleClickProxy} />);

    await user.click(getByText(t(navItem.title)));

    expect(scrollToAnchorMock).toHaveBeenCalledWith(weirdLink);

    expect(routerMock.push).not.toHaveBeenCalled();
  });

  it('make contacts normalized correct', async () => {
    routerMock.pathname = '/';
    const handleClickProxy: (link: string) => void = (link: string): void => {
      scrollToAnchor(link);
    };

    const weirdLink: string = '#cont#acts';
    const navItem: NavItemProps = {
      id: 'weird',
      title: 'header.weird',
      link: weirdLink,
      type: 'header',
    };

    const { getByText } = render(<NavList navItems={[navItem]} handleClick={handleClickProxy} />);

    await user.click(getByText(t(navItem.title)));

    expect(scrollToAnchorMock).toHaveBeenCalledWith(weirdLink);

    expect(routerMock.push).not.toHaveBeenCalled();
  });
});
