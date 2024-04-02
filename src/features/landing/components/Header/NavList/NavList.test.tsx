import { render } from '@testing-library/react';
import React from 'react';

import { NavItemProps } from '../../../types/header/navigation';
import { testDrawerItem, testHeaderItem } from '../constants';

import NavList from './NavList';

const navItems: NavItemProps[] = [testHeaderItem];
const drawerNavItems: NavItemProps[] = [testDrawerItem];

const navWrapperTestId: string = 'nav-wrapper';
const navContentTestId: string = 'nav-content';

describe('NavList component', () => {
  it('renders NavList component correctly with header wrapper', () => {
    const handleClick: () => void = jest.fn();
    const { getByTestId } = render(
      <NavList navItems={navItems} handleClick={handleClick} />
    );

    expect(getByTestId(navWrapperTestId)).toBeInTheDocument();
    expect(getByTestId(navContentTestId)).toBeInTheDocument();
  });

  it('renders NavList component correctly with drawer wrapper', () => {
    const handleClick: () => void = jest.fn();

    const { getByTestId } = render(
      <NavList navItems={drawerNavItems} handleClick={handleClick} />
    );

    expect(getByTestId(navWrapperTestId)).toBeInTheDocument();
    expect(getByTestId(navContentTestId)).toBeInTheDocument();
  });

  it('renders NavList component correctly with empty array', () => {
    const handleClick: () => void = jest.fn();
    const { queryByTestId } = render(
      <NavList navItems={[]} handleClick={handleClick} />
    );

    expect(queryByTestId(navWrapperTestId)).not.toBeInTheDocument();
    expect(queryByTestId(navContentTestId)).not.toBeInTheDocument();
  });
});
