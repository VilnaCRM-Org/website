import '@testing-library/jest-dom';
import { render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import Drawer from '../../features/landing/components/Header/Drawer/Drawer';

const buttonToOpenDrawer: string = 'Button to open the drawer';
const buttonToCloseDrawer: string = 'Button to exit the drawer';
const logoAlt: string = 'Vilna logo';
const drawerContentRole: string = 'presentation';
const listItem: string = 'listitem';

jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useMediaQuery: jest.fn(),
}));

describe('Drawer', () => {
  it('renders drawer button', () => {
    const { getByLabelText } = render(<Drawer />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    expect(drawerButton).toBeInTheDocument();
  });

  it('opens drawer when button is clicked', async () => {
    const { getByLabelText, getAllByRole } = render(<Drawer />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);

    fireEvent.click(drawerButton);
    await waitFor(() => {
      const drawer: HTMLElement[] = getAllByRole(drawerContentRole);
      expect(drawer[0]).toBeInTheDocument();
    });
  });

  it('closes drawer when exit button is clicked', async () => {
    const { getByLabelText, queryByRole } = render(<Drawer />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);
    const exitButton: HTMLElement = getByLabelText(buttonToCloseDrawer);
    fireEvent.click(exitButton);

    await waitFor(() => {
      const drawer: HTMLElement | null = queryByRole(drawerContentRole);
      expect(drawer).not.toBeInTheDocument();
    });
  });

  it('renders logo', () => {
    const { getByLabelText, getByAltText } = render(<Drawer />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);

    fireEvent.click(drawerButton);
    const logo: HTMLElement = getByAltText(logoAlt);
    expect(logo).toBeInTheDocument();
  });

  it('renders nav items', () => {
    const { getByLabelText, getAllByRole } = render(<Drawer />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);
    const navItems: HTMLElement[] = getAllByRole(listItem);
    expect(navItems.length).toBeGreaterThan(0);
  });

  it('closes the drawer when handleCloseDrawer is called', async () => {
    const { getByRole, getByLabelText, queryByRole } = render(<Drawer />);

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);
    const tryItOutButton: HTMLElement = getByRole('button', {
      name: /Try it out/,
    });

    fireEvent.click(tryItOutButton);

    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });
});
