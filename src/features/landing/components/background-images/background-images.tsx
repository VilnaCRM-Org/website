import { Box } from '@mui/material';
import { ImageProps } from 'next/image';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';

import VectorIcon from '../../assets/svg/about-vilna/Vector.svg';

import styles from './styles';

function BackgroundImages(): React.ReactElement {
  const imageOptimizedProps: ImageProps = getOptimizedImageProps({
    src: VectorIcon,
    alt: 'Wave',
  }).props;

  return (
    <Box
      sx={Object.assign(styles.vector, { backgroundImage: `url(${imageOptimizedProps.src})` })}
    />
  );
}

export default BackgroundImages;
