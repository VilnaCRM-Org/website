import { AppBar, Box } from '@mui/material';
import Link from 'next/link';
import { NextRouter, useRouter } from 'next/router';
import Image from 'next-export-optimize-images/image';
import React, { useEffect } from 'react';
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

  useEffect(() => {
    const handleScroll: (url: string) => void = (url: string): void => {
      if (url.includes('#')) {
        const id: string = url.split('#')[1];
        scrollToAnchor(`#${id}`);
      }
    };

    router.events.on('routeChangeComplete', handleScroll);
    handleScroll(router.asPath);

    return () => router.events.off('routeChangeComplete', handleScroll);
  }, [router]);

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
      } catch {
        window.location.href = `/${link}`;
      }
    } else {
      scrollToAnchor(link);
    }
  };

  return (
    <AppBar sx={styles.headerWrapper}>
      <UiToolbar>
        <Link href="/" aria-label={t('header.logo_alt')} style={styles.logoLink}>
          <Box component="span" sx={styles.logo}>
            <Image src={Logo} alt={t('header.logo_alt')} width={131} height={44} />
          </Box>
        </Link>
        <NavList navItems={headerNavList} handleClick={handleLinkClick} />
        <AuthButtons />
        <Drawer handleLinkClick={handleLinkClick} />
      </UiToolbar>
    </AppBar>
  );
}

export default Header;
