import { Grid, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import CustomLink from '@/components/ui/CustomLink/CustomLink';

import useScreenSize from '../../../hooks/useScreenSize/useScreenSize';
import ISocialLink from '../../../types/social/types';
import SignUpSocials from '../SignUpSocials/SignUpSocials';

const styles = {
  mainGrid: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'left',
    zIndex: '100',
  },
  mainHeading: {
    color: '#1A1C1E',
    fontFamily: 'GolosText-Bold, sans-serif',
    fontSize: '46px',
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 'normal',
    marginBottom: '40px',
  },
  mainHeadingMobileOrSmaller: {
    fontSize: '28px',
    marginBottom: '20px',
  },
  mainLink: {
    color: '#1EAEFF',
    fontFamily: 'GolosText-Bold, sans-serif',
    fontSize: '46px',
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 'normal',
  },
};

export default function SignUpTextsContent({ socialLinks }: { socialLinks: ISocialLink[] }) {
  const { t } = useTranslation();
  const { isSmallest, isMobile, isTablet } = useScreenSize();

  return (
    <Grid
      item
      lg={6}
      md={12}
      sx={{
        ...styles.mainGrid,
        textAlign: isSmallest || isMobile || isTablet ? 'center' : styles.mainGrid.textAlign,
      }}
    >
      <Typography
        component="h2"
        variant="h2"
        style={{
          ...styles.mainHeading,
          ...(isSmallest || isMobile ? styles.mainHeadingMobileOrSmaller : {}),
        }}
      >
        {t('sign_up.main_heading')}
        <CustomLink href="/" style={{ ...styles.mainLink }}>
          VilnaCRM
        </CustomLink>
      </Typography>
      <SignUpSocials socialLinks={socialLinks} />
    </Grid>
  );
}