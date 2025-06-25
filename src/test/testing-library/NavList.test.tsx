import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { t } from 'i18next';
import React from 'react';

import {
  headerNavList,
  testDrawerItem,
  testHeaderItem,
} from '../../features/landing/components/Header/constants';
import NavList from '../../features/landing/components/Header/NavList/NavList';
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
