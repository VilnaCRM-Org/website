import Head from 'next/head';
import React from 'react';

import { SWAGGER_SCHEMA_URL } from '../../constants/swagger-schema-url';
import Swagger from '../swagger/swagger';

function SwaggerPage(): React.ReactElement {
  return (
    <>
      <Head>
        <link rel="preload" href={SWAGGER_SCHEMA_URL} as="fetch" crossOrigin="anonymous" />
      </Head>
      <Swagger />
    </>
  );
}

export default SwaggerPage;
