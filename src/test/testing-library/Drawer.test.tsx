import '@testing-library/jest-dom';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { t } from 'i18next';
import React from 'react';

import Drawer from '../../features/landing/components/Header/Drawer/Drawer';

const buttonText: string = t('header.actions.try_it_out');
const buttonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');
const buttonToCloseDrawer: string = t('header.drawer.button_aria_labels.exit');
const logInButtonText: string = t('header.actions.log_in');
const drawerImageAlt: string = t('header.drawer.image_alt.bars');
const exitImageAlt: string = t('header.drawer.image_alt.exit');
const logoAlt: string = t('header.logo_alt');
const drawerContentRole: string = 'menu';
const listItem: string = 'listitem';

describe('Drawer', () => {
  const handleLinkClick: jest.Mock<void, [string]> = jest.fn();

  it('renders drawer button', () => {
    const { getByLabelText, getByAltText } = render(<Drawer handleLinkClick={handleLinkClick} />);

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    const drawerImage: HTMLElement = getByAltText(drawerImageAlt);

    expect(drawerButton).toBeInTheDocument();
    expect(drawerImage).toBeInTheDocument();
  });

  it('opens drawer when button is clicked', async () => {
    const { getByLabelText, getByRole, getByAltText, getByText } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);

    const drawer: HTMLElement = getByRole(drawerContentRole);
    const exitImage: HTMLElement = getByAltText(exitImageAlt);
    const logInButton: HTMLElement = getByText(logInButtonText);

    expect(drawer).toBeInTheDocument();
    expect(exitImage).toBeInTheDocument();
    expect(logInButton).toBeInTheDocument();
  });

  it('closes drawer when exit button is clicked', async () => {
    const { getByLabelText, queryByRole } = render(<Drawer handleLinkClick={handleLinkClick} />);

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);

    const exitButton: HTMLElement = getByLabelText(buttonToCloseDrawer);
    fireEvent.click(exitButton);

    const drawer: HTMLElement | null = queryByRole(drawerContentRole);
    expect(drawer).not.toBeInTheDocument();
  });

  it('renders logo', () => {
    const { getByLabelText, getByAltText } = render(<Drawer handleLinkClick={handleLinkClick} />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);

    fireEvent.click(drawerButton);
    const logo: HTMLElement = getByAltText(logoAlt);
    expect(logo).toBeInTheDocument();
  });

  it('renders nav items', () => {
    const { getByLabelText, getAllByRole } = render(<Drawer handleLinkClick={handleLinkClick} />);
    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);
    const navItems: HTMLElement[] = getAllByRole(listItem);
    expect(navItems.length).toBeGreaterThan(0);
  });

  it('closes the drawer when handleCloseDrawer is called', async () => {
    const { getByRole, getByLabelText, queryByRole } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);
    const tryItOutButton: HTMLElement = getByRole('button', {
      name: buttonText,
    });

    fireEvent.click(tryItOutButton);

    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });

  it('calls handleLinkClick when nav item link is clicked', async () => {
    const { getByLabelText, getByText, queryByRole } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);

    const advantagesLink: HTMLElement = getByText(t('header.advantages'));
    fireEvent.click(advantagesLink);

    expect(handleLinkClick).toHaveBeenCalledWith('#Advantages');
    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });

  it('calls handleLinkClick and closes drawer when nav item is clicked', async () => {
    const { getByLabelText, getByText, queryByRole } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    const drawerButton: HTMLElement = getByLabelText(buttonToOpenDrawer);
    fireEvent.click(drawerButton);

    const contactsLink: HTMLElement = getByText(t('header.contacts'));
    fireEvent.click(contactsLink);

    expect(handleLinkClick).toHaveBeenCalledWith('#Contacts');
    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });
});
