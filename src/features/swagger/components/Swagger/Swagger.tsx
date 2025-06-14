import { Box, Container } from '@mui/material';
import Head from 'next/head';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import UiFooter from '@/components/UiFooter';

import ApiDocumentation from '../ApiDocumentation/ApiDocumentation';
import Header from '../Header/Header';
import Navigation from '../Navigation/Navigation';

import styles from './styles';

function Swagger(): React.ReactElement {
  const { t, i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage('en');
  }, [i18n]);

  return (
    <>
      <Head>
        <title>{t('VilnaCRM API')}</title>
        <meta name="description" content={t('The first Ukrainian open source CRM')} />
        <link rel="apple-touch-icon" href="../../assets/img/about-vilna/touch.png" />
      </Head>
      <Header />
      <Box sx={styles.wrapper}>
        <Container maxWidth="xl">
          <Navigation />
          <ApiDocumentation />
        </Container>
      </Box>
      <UiFooter />
    </>
  );
}

export default Swagger;
