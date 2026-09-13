import dynamic from 'next/dynamic';
import React, { ComponentType } from 'react';

import { Loading } from '../loading';

const LazySwagger: ComponentType = dynamic(() => import('../swagger/swagger'), {
  ssr: false,
  loading: () => <Loading />,
});

function SwaggerPage(): React.ReactElement {
  return <LazySwagger />;
}

export default SwaggerPage;
