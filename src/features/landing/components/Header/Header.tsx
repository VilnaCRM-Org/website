import { AppBar } from '@mui/material';
import { NextRouter, useRouter } from 'next/router';
import Image from 'next-export-optimize-images/image';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { UiToolbar } from '@/components';

import Logo from '../../assets/svg/logo/Logo.svg';
import normalizeLink from '../../helpers/normalizeLink';
import scrollToAnchor from '../../helpers/scrollToAnchor';

import { AuthButtons } from './AuthButtons';
import { headerNavList } from './constants';
import { Drawer } from './Drawer';
import { NavList } from './NavList';
import styles from './styles';

function Header(): React.ReactElement {
  const { t } = useTranslation();
  const router: NextRouter = useRouter();

  const handleLinkClick: (link: string) => void = async (link: string) => {
    const normalized: string = normalizeLink(link);
    if (normalized === 'contacts') {
      scrollToAnchor(link);
      return;
    }

    if (router.pathname !== '/') {
      try {
        await router.push(`/${link}`, undefined, { scroll: true });
        scrollToAnchor(link);
      } catch (error) {
        window.location.href = `/${link}`;
      }
    } else {
      scrollToAnchor(link);
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
