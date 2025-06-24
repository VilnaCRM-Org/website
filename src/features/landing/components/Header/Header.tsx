import { AppBar } from '@mui/material';
import { NextRouter, useRouter } from 'next/router';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiToolbar } from '@/components';

import Logo from '../../assets/svg/logo/Logo.svg';

import { AuthButtons } from './AuthButtons';
import { headerNavList } from './constants';
import { Drawer } from './Drawer';
import { NavList } from './NavList';
import styles from './styles';

function Header(): React.ReactElement {
  const { t } = useTranslation();
  const router: NextRouter = useRouter();

  const handleLinkClick: (link: string) => void = (link: string) => {
    if (router.pathname !== '/' && link !== 'contacts') {
      router.push(`/${link}`);
    } else {
      const id: string = link.startsWith('#') ? link.slice(1) : link;
      const el: HTMLElement | null = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  return (
    <AppBar sx={styles.headerWrapper}>
      <UiToolbar>
        <Image src={Logo} alt={t('header.logo_alt')} width={131} height={44} />
        <NavList navItems={headerNavList} handleClick={handleLinkClick} />
        <AuthButtons />
        <Drawer />
      </UiToolbar>
    </AppBar>
  );
}

export default Header;
