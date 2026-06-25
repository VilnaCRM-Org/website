import { Box } from '@mui/material';

import CardGrid from './CardGrid';
import CardSwiper from './CardSwiper';
import styles from './styles';
import { CardList } from './types';

function UiCardList({ cardList, hoverCardContent }: CardList): React.ReactElement {
  return (
    <>
      <Box sx={styles.gridContainerLargeScreen}>
        <CardGrid cardList={cardList} hoverCardContent={hoverCardContent} />
      </Box>
      <Box sx={styles.swiperContainerSmallScreen}>
        <CardSwiper cardList={cardList} hoverCardContent={hoverCardContent} />
      </Box>
    </>
  );
}

export default UiCardList;
