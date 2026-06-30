import { Box, Container } from '@mui/material';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import ApiDocumentation from '../api-documentation/api-documentation';
import Navigation from '../navigation/navigation';

import styles from './styles';

function Swagger(): React.ReactElement {
  const { i18n } = useTranslation();

  useEffect(() => {
    i18n.changeLanguage('en');
  }, [i18n]);

  return (
    <Box sx={styles.wrapper}>
      <Container maxWidth="xl">
        <Navigation />
        <ApiDocumentation />
      </Container>
    </Box>
  );
}

export default Swagger;
