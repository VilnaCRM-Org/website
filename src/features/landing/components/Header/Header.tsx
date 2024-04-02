import { AppBar, Link } from '@mui/material';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiToolbar, UiImage } from '@/components';

import Logo from '../../assets/svg/logo/Logo.svg';

import { AuthButtons } from './AuthButtons';
import { headerNavList } from './constants';
import { Drawer } from './Drawer';
import { NavList } from './NavList';
import styles from './styles';

function Header(): React.ReactElement {
  const { t } = useTranslation();

  return (
    <AppBar position="static" sx={styles.headerWrapper}>
      <UiToolbar>
        <Link href="/#">
          <UiImage src={Logo} alt={t('header.logo_alt')} sx={styles.logo} />
        </Link>
        <NavList navItems={headerNavList} />
        <AuthButtons />
        <Drawer />
      </UiToolbar>
    </AppBar>
  );
}

export default Header;