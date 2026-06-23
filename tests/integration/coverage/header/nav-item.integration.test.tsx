import { render } from '@testing-library/react';

import NavItem from '@landing/Header/NavItem/NavItem';

import {
  testDrawerItem,
  testHeaderItem,
} from '../../../../src/test/testing-library/fixtures/header-nav.fixtures';

const handleClick: () => void = jest.fn();

const listItemClass: string = '.MuiListItem-root';
const titleMediumClass: string = '.MuiTypography-medium15';
const titleDemiClass: string = '.MuiTypography-demi18';
const linkRole: string = 'link';

const widthStyle: string = 'width: 100%';
const paddingTopStyle: string = 'padding-top: 8px';
const paddingStyle: string = 'padding: 0px';
const displayStyle: string = 'display: flex';
const textDecorationStyle: string = 'text-decoration: none';
const alignItemsStyle: string = 'align-items: center';

describe('integration: NavItem', () => {
  it('renders the header variant', () => {
    const { container, getByText, getByRole } = render(
      <NavItem item={testHeaderItem} handleClick={handleClick} />
    );

    const listItem: HTMLElement | null = container.querySelector(listItemClass);
    const linkElement: HTMLElement = getByRole(linkRole);
    const linkText: HTMLElement = getByText(testHeaderItem.title);
    const linkMediumText: HTMLElement | null = container.querySelector(titleMediumClass);

    expect(listItem).toBeInTheDocument();
    expect(listItem).toHaveStyle(paddingTopStyle);
    expect(listItem).not.toHaveStyle(paddingStyle);
    expect(linkText).toBeInTheDocument();
    expect(linkMediumText).toBeInTheDocument();
    expect(linkElement).toHaveStyle(textDecorationStyle);
    expect(linkElement).not.toHaveStyle(displayStyle);
    expect(linkElement).not.toHaveStyle(alignItemsStyle);
    expect(linkElement).not.toHaveStyle(widthStyle);
  });

  it('renders the drawer variant', () => {
    const { container, getByText, getByRole } = render(
      <NavItem item={testDrawerItem} handleClick={handleClick} />
    );

    const listItem: HTMLElement | null = container.querySelector(listItemClass);
    const linkElement: HTMLElement = getByRole(linkRole);
    const linkText: HTMLElement = getByText(testDrawerItem.title);
    const linkDemiText: HTMLElement | null = container.querySelector(titleDemiClass);

    expect(listItem).toBeInTheDocument();
    expect(listItem).toHaveStyle(paddingStyle);
    expect(listItem).not.toHaveStyle(paddingTopStyle);
    expect(linkText).toBeInTheDocument();
    expect(linkDemiText).toBeInTheDocument();
    expect(linkElement).toHaveStyle(widthStyle);
    expect(linkElement).toHaveStyle(displayStyle);
    expect(linkElement).toHaveStyle(alignItemsStyle);
  });
});
