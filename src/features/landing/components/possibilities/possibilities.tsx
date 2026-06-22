import { Box } from '@mui/material';
import React from 'react';

import UiCardList from '@/components/ui-card-list';

import { cardList } from './constants';
import { RegistrationText } from './registration-text';
import { ServicesHoverCard } from './services-hover-card';
import styles from './styles';

function Possibilities(): React.ReactElement {
  return (
    <Box sx={styles.wrapper} id="Integration" component="section">
      <RegistrationText />
      <UiCardList cardList={cardList} hoverCardContent={<ServicesHoverCard />} />
    </Box>
  );
}

export default Possibilities;
