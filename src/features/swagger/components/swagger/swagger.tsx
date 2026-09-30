import { Box, Container } from '@mui/material';
import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

import { Loading } from '../loading';
import Navigation from '../navigation/navigation';

import styles from './styles';

const LazyApiDocumentation: ComponentType = dynamic(
  () => import('../api-documentation/api-documentation'),
  {
    ssr: false,
    loading: () => <Loading />,
  }
);

function Swagger(): React.ReactElement {
  return (
    <Box sx={styles.wrapper}>
      <Container maxWidth="xl">
        <Navigation />
        <LazyApiDocumentation />
      </Container>
    </Box>
  );
}

export default Swagger;
