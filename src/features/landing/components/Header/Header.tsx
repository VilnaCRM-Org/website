import { AppBar } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiImage, UiToolbar } from '@/components';

import Logo from '../../assets/svg/logo/Logo.svg';

import { AuthButtons } from './AuthButtons';
import { links } from './constants';
import { Drawer } from './Drawer';
import { NavLink } from './NavLink';
import styles from './styles';

function Header(): React.ReactElement {
  const { t } = useTranslation();
  return (
    <AppBar position="static" sx={styles.headerWrapper}>
      <UiToolbar>
        <UiImage src={Logo} alt={t('header.logo_alt')} sx={styles.logo} />
        <NavLink links={links} />
        <AuthButtons />
        <Drawer />
      </UiToolbar>
    </AppBar>
  );
}

export default Header;
