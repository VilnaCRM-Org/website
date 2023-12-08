import { Grid } from '@mui/material';
import Drawer from '@mui/material/Drawer';
import * as React from 'react';
import { useTranslation } from 'react-i18next';

import HeaderDrawerEmail from '../HeaderDrawerEmail/HeaderDrawerEmail';
import HeaderDrawerSocials from '../HeaderDrawerSocials/HeaderDrawerSocials';
import HeaderMobileLink from '../HeaderMobileLink/HeaderMobileLink';
import HeaderTopContentInMobileView from '../HeaderTopContentInMobileView/HeaderTopContentInMobileView';

interface IHeaderDrawerMenuProps {
  isDrawerOpen: boolean;
  onToggleDrawer: () => void;
  onSignInButtonClick: () => void;
  onTryItOutButtonClick: () => void;
}

export default function HeaderDrawerMenu({
  isDrawerOpen,
  onToggleDrawer,
  onSignInButtonClick,
  onTryItOutButtonClick,
}: IHeaderDrawerMenuProps) {
  const { t } = useTranslation();
  const drawerStyles = {
    position: 'absolute',
    bottom: isDrawerOpen ? '0' : '-100%', // Slide in from the bottom or hide
    transition: 'bottom 0.3s ease-in-out',
  };

  return (
    <Drawer
      anchor="right"
      open={isDrawerOpen}
      onClose={onToggleDrawer}
      elevation={4}
      sx={{ ...drawerStyles }}
      PaperProps={{
        sx: { width: '100%', maxWidth: '31.25rem' },
      }}
    >
      <Grid
        container
        sx={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 15px 24px 15px',
          maxWidth: '100%',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <HeaderTopContentInMobileView
          onSignInButtonClick={onSignInButtonClick}
          onTryItOutButtonClick={onTryItOutButtonClick}
          onMobileViewDrawerClose={onToggleDrawer}
          onDrawerClose={onToggleDrawer}
        />

        <Grid item sx={{ width: '100%' }}>
          <HeaderMobileLink
            href="/"
            linkNameText={t('header.advantages')}
            onClick={onToggleDrawer}
          />
        </Grid>
        <Grid item sx={{ width: '100%' }}>
          <HeaderMobileLink href="/" linkNameText={t('header.for_who')} onClick={onToggleDrawer} />
        </Grid>
        <Grid item sx={{ width: '100%' }}>
          <HeaderMobileLink
            href="/"
            linkNameText={t('header.integration')}
            onClick={onToggleDrawer}
          />
        </Grid>
        <Grid item sx={{ width: '100%' }}>
          <HeaderMobileLink href="/" linkNameText={t('header.contacts')} onClick={onToggleDrawer} />
        </Grid>

        <Grid item sx={{ width: '100%' }}>
          <HeaderDrawerEmail />
        </Grid>

        <Grid item sx={{ width: '100%', marginTop: '26px' }}>
          <HeaderDrawerSocials />
        </Grid>
      </Grid>
    </Drawer>
  );
}