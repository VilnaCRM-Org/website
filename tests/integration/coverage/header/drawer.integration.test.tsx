import '@testing-library/jest-dom';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { t } from 'i18next';

import Drawer from '@components/Header/Drawer/Drawer';

const buttonText: string = t('header.actions.try_it_out');
const buttonToOpenDrawer: string = t('header.drawer.button_aria_labels.bars');
const buttonToCloseDrawer: string = t('header.drawer.button_aria_labels.exit');
const logInButtonText: string = t('header.actions.log_in');
const drawerImageAlt: string = t('header.drawer.image_alt.bars');
const exitImageAlt: string = t('header.drawer.image_alt.exit');
const logoAlt: string = t('header.logo_alt');
const drawerContentRole: string = 'menu';
const listItem: string = 'listitem';

describe('integration: Drawer', () => {
  const handleLinkClick: jest.Mock<void, [string]> = jest.fn();

  it('renders the drawer toggle button and its icon', () => {
    const { getByLabelText, getByAltText } = render(<Drawer handleLinkClick={handleLinkClick} />);

    expect(getByLabelText(buttonToOpenDrawer)).toBeInTheDocument();
    expect(getByAltText(drawerImageAlt)).toBeInTheDocument();
  });

  it('opens the drawer when the toggle button is clicked', () => {
    const { getByLabelText, getByRole, getByAltText, getByText } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    fireEvent.click(getByLabelText(buttonToOpenDrawer));

    expect(getByRole(drawerContentRole)).toBeInTheDocument();
    expect(getByAltText(exitImageAlt)).toBeInTheDocument();
    expect(getByText(logInButtonText)).toBeInTheDocument();
  });

  it('closes the drawer when the exit button is clicked', async () => {
    const { getByLabelText, queryByRole } = render(<Drawer handleLinkClick={handleLinkClick} />);

    fireEvent.click(getByLabelText(buttonToOpenDrawer));
    fireEvent.click(getByLabelText(buttonToCloseDrawer));

    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });

  it('renders the logo inside the open drawer', () => {
    const { getByLabelText, getByAltText } = render(<Drawer handleLinkClick={handleLinkClick} />);

    fireEvent.click(getByLabelText(buttonToOpenDrawer));

    expect(getByAltText(logoAlt)).toBeInTheDocument();
  });

  it('renders the logo link pointing to home with aria-label', () => {
    const { getByLabelText, getByRole } = render(<Drawer handleLinkClick={handleLinkClick} />);

    fireEvent.click(getByLabelText(buttonToOpenDrawer));

    const logoLink: HTMLElement = getByRole('link', { name: logoAlt });

    expect(logoLink).toHaveAttribute('href', '/');
    expect(logoLink).toHaveAttribute('aria-label', logoAlt);
  });

  it('renders nav items inside the open drawer', () => {
    const { getByLabelText, getAllByRole } = render(<Drawer handleLinkClick={handleLinkClick} />);

    fireEvent.click(getByLabelText(buttonToOpenDrawer));

    expect(getAllByRole(listItem).length).toBeGreaterThan(0);
  });

  it('closes the drawer when the "try it out" CTA is clicked', async () => {
    const { getByRole, getByLabelText, queryByRole } = render(
      <Drawer handleLinkClick={handleLinkClick} />
    );

    fireEvent.click(getByLabelText(buttonToOpenDrawer));
    fireEvent.click(getByRole('link', { name: buttonText }));

    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });

  it('calls handleLinkClick and closes the drawer for an anchor nav item', async () => {
    const localHandleLinkClick: jest.Mock = jest.fn();
    const { getByLabelText, getByText, queryByRole } = render(
      <Drawer handleLinkClick={localHandleLinkClick} />
    );

    fireEvent.click(getByLabelText(buttonToOpenDrawer));
    fireEvent.click(getByText(t('header.advantages')));

    expect(localHandleLinkClick).toHaveBeenCalledWith('#Advantages');
    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });

  it('calls handleLinkClick and closes the drawer for the contacts nav item', async () => {
    const localHandleLinkClick: jest.Mock = jest.fn();
    const { getByLabelText, getByText, queryByRole } = render(
      <Drawer handleLinkClick={localHandleLinkClick} />
    );

    fireEvent.click(getByLabelText(buttonToOpenDrawer));
    fireEvent.click(getByText(t('header.contacts')));

    expect(localHandleLinkClick).toHaveBeenCalledWith('#Contacts');
    await waitFor(() => {
      expect(queryByRole(drawerContentRole)).not.toBeInTheDocument();
    });
  });
});
