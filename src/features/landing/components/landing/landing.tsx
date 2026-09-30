import { Box } from '@mui/material';
import dynamic from 'next/dynamic';
import { ComponentType } from 'react';

import styles from './styles';

const DynamicLandingSections: ComponentType = dynamic(() => import('../landing-sections'), {
  ssr: false,
  loading: () => <Box sx={styles.placeholder} />,
});

function Landing(): React.ReactElement {
  return <DynamicLandingSections />;
}

export default Landing;
