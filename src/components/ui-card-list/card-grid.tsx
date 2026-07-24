import { Grid } from '@mui/material';
import { CSSProperties } from 'react';

import UiCardItem from '../ui-card-item';

import styles from './styles';
import { CardList } from './types';

function CardGrid({ cardList, hoverCardContent }: CardList): React.ReactElement | null {
  const [firstCard] = cardList;
  if (firstCard === undefined) {
    return null;
  }

  const grid: CSSProperties = firstCard.type === 'smallCard' ? styles.smallGrid : styles.largeGrid;

  return (
    <Grid sx={grid}>
      {cardList.map(item => (
        <UiCardItem key={item.id} item={item} hoverCardContent={hoverCardContent} />
      ))}
    </Grid>
  );
}
export default CardGrid;
