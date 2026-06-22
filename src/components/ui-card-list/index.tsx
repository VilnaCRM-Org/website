import { Box } from '@mui/material';

import CardGrid from './card-grid';
import CardSwiper from './card-swiper';
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
