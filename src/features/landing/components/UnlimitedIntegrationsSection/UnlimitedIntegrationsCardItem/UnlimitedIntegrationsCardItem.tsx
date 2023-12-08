import { Card, Paper, Typography } from '@mui/material';
import Image from 'next/image';
import React from 'react';
import ReactHtmlParser from 'react-html-parser';
import { useTranslation } from 'react-i18next';

import IUnlimitedIntegrationsItem from '../../../types/unlimited-integrations/types';

interface IUnlimitedIntegrationsCardItemProps {
  cardItem: IUnlimitedIntegrationsItem;
  style?: React.CSSProperties;
}

const styles = {
  card: {
    padding: '40px 32px 66px 25px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '332px',
    height: '100%',
    width: '100%',
    border: '1px solid #EAECEE',
    borderRadius: '12px',
    cursor: 'pointer',
  },
  paperWithImage: {
    width: '100%',
    maxWidth: '44px',
    height: '100%',
    maxHeight: '80px',
    marginBottom: '35px',
  },
  imageInsideOfPaper: {
    height: '100%',
    width: '100%',
    maxWidth: '100%',
  },
  title: {
    color: '#1A1C1E',
    fontFamily: 'GolosText-Regular, sans-serif',
    fontSize: '22px',
    fontStyle: 'normal',
    fontWeight: '700',
    lineHeight: 'normal',
    marginBottom: '10px',
  },
  text: {
    color: '#1A1C1E',
    fontFamily: 'GolosText-Regular, sans-serif',
    fontSize: '16px',
    fontStyle: 'normal',
    fontWeight: '400',
    lineHeight: '26px',
    '& a': {
      textDecoration: 'underline',
      color: '#1EAEFF',
      fontWeight: '700',
    },
  },
};

export default function UnlimitedIntegrationsCardItem({
  cardItem,
  style,
}: IUnlimitedIntegrationsCardItemProps) {
  const { t } = useTranslation();

  return (
    <Card
      sx={{
        ...styles.card,
        ...style,
      }}
    >
      <Paper
        sx={{
          ...styles.paperWithImage,
        }}
        elevation={0}
      >
        <Image
          width={150}
          height={150}
          src={cardItem.imageSrc}
          alt={t(cardItem.imageTitle)}
          style={{
            ...styles.imageInsideOfPaper,
            objectFit: 'cover',
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        />
      </Paper>

      <Typography
        component="h4"
        variant="h4"
        style={{
          ...styles.title,
        }}
      >
        {t(cardItem.title)}
      </Typography>

      <Typography
        component="p"
        variant="body1"
        style={{
          ...styles.text,
        }}
      >
        {ReactHtmlParser(t(cardItem.text))}
      </Typography>
    </Card>
  );
}

UnlimitedIntegrationsCardItem.defaultProps = {
  style: {},
};