import { Box } from '@mui/material';
import { getOptimizedImageProps } from 'next-export-optimize-images/image';
import React from 'react';

import VectorIcon from '../../assets/svg/about-vilna/Vector.svg';

import styles from './styles';

function BackgroundImages(): React.ReactElement {
  // Infer the optimizer's own props type; next/image's `ImageProps` is stricter
  // under `exactOptionalPropertyTypes` and rejects the assignment.
  const imageOptimizedProps: ReturnType<typeof getOptimizedImageProps>['props'] =
    getOptimizedImageProps({
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
