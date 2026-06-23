import { fireEvent, render } from '@testing-library/react';
import userEvent, { UserEvent } from '@testing-library/user-event';
import { t } from 'i18next';

import { headerNavList, testDrawerItem, testHeaderItem } from '@landing/Header/constants';
import NavList from '@landing/Header/NavList/NavList';

import { NavItemProps } from '../../../../src/features/landing/types/header/navigation';

const handleClick: () => void = jest.fn();

const navItems: NavItemProps[] = [testHeaderItem];
const drawerNavItems: NavItemProps[] = [testDrawerItem];

const navWrapperClass: string = '.MuiStack-root';
const navContentClass: string = '.MuiList-root';

const displayNoneStyle: string = 'display: none';
const flexColumnStyle: string = 'flex-direction: column';
const flexStyle: string = 'display: flex';
const marginTopStyle: string = 'margin-top: 6rem';

describe('integration: NavList render', () => {
  it('renders the header wrapper variant', () => {
    const { container } = render(<NavList navItems={navItems} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).toBeInTheDocument();
    expect(container.querySelector(navWrapperClass)).toHaveStyle(displayNoneStyle);
    expect(container.querySelector(navWrapperClass)).toHaveStyle(flexColumnStyle);
    expect(container.querySelector(navWrapperClass)).not.toHaveStyle(marginTopStyle);
    expect(container.querySelector(navContentClass)).toBeInTheDocument();
    expect(container.querySelector(navContentClass)).toHaveStyle(flexStyle);
    expect(container.querySelector(navContentClass)).not.toHaveStyle(flexColumnStyle);
  });

  it('renders the drawer wrapper variant', () => {
    const { container } = render(<NavList navItems={drawerNavItems} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).toBeInTheDocument();
    expect(container.querySelector(navWrapperClass)).not.toHaveStyle(displayNoneStyle);
    expect(container.querySelector(navContentClass)).toBeInTheDocument();
    expect(container.querySelector(navContentClass)).toHaveStyle(flexColumnStyle);
  });

  it('renders the fallback for an empty array', () => {
    const { container, getByText } = render(<NavList navItems={[]} handleClick={handleClick} />);

    expect(container.querySelector(navWrapperClass)).not.toBeInTheDocument();
    expect(container.querySelector(navContentClass)).not.toBeInTheDocument();
    expect(getByText('Something went wrong')).toBeInTheDocument();
  });

  it('invokes handleClick with the correct link on item click', async () => {
    const clickSpy: jest.Mock = jest.fn();

    const { getByText } = render(<NavList navItems={headerNavList} handleClick={clickSpy} />);

    await userEvent.click(getByText(t(headerNavList[0].title)));

    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledWith('#Advantages');
  });

  it('does not throw when handleClick is undefined', () => {
    const { container } = render(<NavList navItems={navItems} handleClick={undefined} />);

    const firstNavItem: Element | null = container.querySelector('a');

    expect(firstNavItem).not.toBeNull();
    if (firstNavItem) {
      expect(() => fireEvent.click(firstNavItem)).not.toThrow();
    }
  });
});

describe('integration: NavList navigation behaviour', () => {
  const user: UserEvent = userEvent.setup();

  it('passes the clicked link through to the callback', async () => {
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
});
