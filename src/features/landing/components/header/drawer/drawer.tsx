import { Drawer, Box, Stack, Button, Link } from '@mui/material';
import NextLink from 'next/link';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import Logo from '@/assets/svg/logo/Logo.svg';
import { UiButton } from '@/components';
import { SocialMediaList } from '@/components/social-media';

import Bars from '../../../assets/svg/header-drawer/menu-04.svg';
import CloseImage from '../../../assets/svg/header-drawer/x-close.svg';
import { drawerNavList, socialMedia } from '../constants';
import NavList from '../nav-list/nav-list';

import styles from './styles';
import { VilnaCRMEmail } from './vilna-crm-email';

function DrawerHeader({ onClose }: { onClose: () => void }): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
      <Link
        href="/"
        component={NextLink}
        sx={styles.logoLink}
        aria-label={t('header.logo_alt') as string}
      >
        <Box component="span" sx={styles.logo}>
          <Image src={Logo} alt={t('header.logo_alt')} width={131} height={44} />
        </Box>
      </Link>
      <Button
        aria-label={t('header.drawer.button_aria_labels.exit') as string}
        sx={styles.button}
        onClick={onClose}
      >
        <Image src={CloseImage} alt={t('header.drawer.image_alt.exit')} width={24} height={24} />
      </Button>
    </Stack>
  );
}

function DrawerActions({ onClose }: { onClose: () => void }): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Stack
      direction="row"
      sx={{
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.563rem',
        mt: '0.75rem',
      }}
    >
      <UiButton fullWidth variant="outlined" size="small" disabled>
        {t('header.actions.log_in')}
      </UiButton>
      <UiButton href="#signUp" fullWidth onClick={onClose} variant="contained" size="small">
        {t('header.actions.try_it_out')}
      </UiButton>
    </Stack>
  );
}

function DrawerContent({
  onClose,
  handleLinkClick,
}: {
  onClose: () => void;
  handleLinkClick: (link: string) => void;
}): React.ReactElement {
  return (
    <Box
      role="presentation"
      sx={[styles.drawerContent, { width: '23.4375rem', textAlign: 'center' }]}
    >
      <DrawerHeader onClose={onClose} />
      <DrawerActions onClose={onClose} />
      <NavList
        navItems={drawerNavList}
        handleClick={(link: string) => {
          handleLinkClick(link);
          onClose();
        }}
      />
      <VilnaCRMEmail />
      <SocialMediaList socialLinks={socialMedia} />
    </Box>
  );
}

function CustomDrawer({
  handleLinkClick,
}: {
  handleLinkClick: (link: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const handleCloseDrawer: () => void = () => setIsDrawerOpen(false);
  const handleOpenDrawer: () => void = () => setIsDrawerOpen(true);

  return (
    <Box sx={styles.wrapper}>
      <Button
        aria-label={t('header.drawer.button_aria_labels.bars')}
        sx={styles.button}
        onClick={handleOpenDrawer}
      >
        <Image src={Bars} alt={t('header.drawer.image_alt.bars')} width={24} height={24} />
      </Button>
      {/*
        No `role` override here. `role="menu"` used to be set on the Drawer, and MUI
        forwards it to the modal root — the wrapper holding the backdrop and the
        paper. ARIA gives `menu` required owned elements (`menuitem` and friends), so
        a backdrop and a `[role=dialog]` made that root fail axe's
        `aria-required-children` at critical impact (SC 1.3.1), found by the
        interaction-state scan added in #369.
        Neither alternative works: `menuitem` on the nav links would override their
        `link` role and oblige the full APG menu keyboard model (arrows, Home/End,
        type-ahead), and moving `role="menu"` onto the inner `<nav>` would destroy the
        navigation landmark. This is site navigation inside a modal dialog, which is
        exactly what MUI already exposes — `role="dialog"`, `aria-modal="true"` and
        `tabIndex={-1}` on the paper slot whenever `variant` is `temporary` (its
        default), with a real `<nav>` list inside. Locate the open drawer by the
        `dialog` role: four tests do, in jsdom and in all three browsers, so if an
        MUI upgrade ever stopped emitting it they fail loudly instead of silently
        losing dialog semantics. Naming that dialog is tracked in #435 — and the
        name has to go on the paper slot, since props land on the modal root, where
        `aria-label` is prohibited on `role="presentation"`.
      */}
      <Drawer sx={styles.drawer} anchor="right" open={isDrawerOpen} onClose={handleCloseDrawer}>
        <DrawerContent onClose={handleCloseDrawer} handleLinkClick={handleLinkClick} />
      </Drawer>
    </Box>
  );
}

export default CustomDrawer;
