import { AppBar, Box } from '@mui/material';
import Link from 'next/link';
import { NextRouter, useRouter } from 'next/router';
import Image from 'next-export-optimize-images/image';
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import Logo from '@/assets/svg/logo/Logo.svg';
import { UiToolbar } from '@/components';

import fallbackNavigate from '../../helpers/fallbackNavigate';
import normalizeLink from '../../helpers/normalizeLink';
import scrollToAnchor from '../../helpers/scrollToAnchor';

import { AuthButtons } from './auth-buttons';
import { headerNavList } from './constants';
import { Drawer } from './drawer';
import { NavList } from './nav-list';
import styles from './styles';

async function navigateToLink(router: NextRouter, link: string): Promise<void> {
  try {
    await router.push(`/${link}`, undefined, { scroll: true });
    scrollToAnchor(link);
  } catch {
    fallbackNavigate(`/${link}`);
  }
}

// Factory bound to the live `router` (never a module-scope constant handler).
function createLinkClickHandler(router: NextRouter): (link: string) => void {
  return async (link: string): Promise<void> => {
    const normalized: string = normalizeLink(link);

    // Anchor scroll covers same-page nav and the contacts shortcut; any other
    // route navigates first, then scrolls (navigateToLink owns the fallback).
    if (normalized === 'contacts' || router.pathname === '/') {
      scrollToAnchor(link);
      return;
    }

    await navigateToLink(router, link);
  };
}

function useScrollOnRouteChange(router: NextRouter): void {
  useEffect(() => {
    const handleScroll: (url: string) => void = (url: string): void => {
      if (url.includes('#')) {
        // Guarded by `includes('#')`, so split always yields a second segment;
        // assert it (rather than a `?? ''` fallback that adds an unreachable,
        // coverage-breaking branch) under `noUncheckedIndexedAccess`.
        const id: string = url.split('#')[1]!;
        scrollToAnchor(`#${id}`);
      }
    };

    router.events.on('routeChangeComplete', handleScroll);
    handleScroll(router.asPath);

    return () => router.events.off('routeChangeComplete', handleScroll);
  }, [router]);
}

// Keeps the live `router` in scope (it must never be hoisted to module scope)
// and owns the routeChangeComplete scroll effect; returns the nav click handler.
function useHeaderNavigation(router: NextRouter): (link: string) => void {
  useScrollOnRouteChange(router);
  return createLinkClickHandler(router);
}

function Header(): React.ReactElement {
  const { t } = useTranslation();
  const router: NextRouter = useRouter();
  const handleLinkClick: (link: string) => void = useHeaderNavigation(router);

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
