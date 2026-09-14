import { Box, Container } from '@mui/material';

import ApiDocumentation from '../api-documentation/api-documentation';
import Navigation from '../navigation/navigation';

import styles from './styles';

function Swagger(): React.ReactElement {
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
