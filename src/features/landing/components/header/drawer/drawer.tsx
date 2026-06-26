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
    <Box role="presentation" sx={[styles.drawerContent, { width: '23.4375rem', textAlign: 'center' }]}>
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
      <Drawer
        sx={styles.drawer}
        anchor="right"
        open={isDrawerOpen}
        onClose={handleCloseDrawer}
        role="menu"
      >
        <DrawerContent onClose={handleCloseDrawer} handleLinkClick={handleLinkClick} />
      </Drawer>
    </Box>
  );
}

export default CustomDrawer;
