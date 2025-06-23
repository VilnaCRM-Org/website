import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

const ReactSwagger: ComponentType = dynamic(
  () => import('@/features/swagger').then(mod => mod.Swagger),
  {
    ssr: false,
    loading: () => <p>Loading API documentation…</p>,
  }
);

export default function Swagger(): React.ReactElement {
  return <ReactSwagger />;
}
