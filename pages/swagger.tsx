import { CircularProgress, Container } from '@mui/material';
import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

const ReactSwagger: ComponentType = dynamic(
  () => import('@/features/swagger').then(mod => mod.Swagger),
  {
    ssr: false,
    loading: () => (
      <Container>
        <CircularProgress
          color="primary"
          size={70}
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      </Container>
    ),
  }
);

export default function Swagger(): React.ReactElement {
  return <ReactSwagger />;
}
