import dynamic from 'next/dynamic';
import Head from 'next/head';
import React, { ComponentType } from 'react';

import { SWAGGER_SCHEMA_URL } from '../../constants/swagger-schema-url';
import { Loading } from '../loading';

const LazySwagger: ComponentType = dynamic(() => import('../swagger/swagger'), {
  ssr: false,
  loading: () => <Loading />,
});

function SwaggerPage(): React.ReactElement {
  return (
    <>
      <Head>
        <link rel="preload" href={SWAGGER_SCHEMA_URL} as="fetch" crossOrigin="anonymous" />
      </Head>
      <LazySwagger />
    </>
  );
}

export default SwaggerPage;
