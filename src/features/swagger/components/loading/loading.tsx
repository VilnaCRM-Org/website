import { CircularProgress, Container } from '@mui/material';
import React from 'react';

import styles from './styles';

function Loading(): React.ReactElement {
  return (
    <Container>
      <CircularProgress color="primary" size={70} sx={styles.spinner} />
    </Container>
  );
}

export default Loading;
