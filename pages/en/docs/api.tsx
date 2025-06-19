import Head from 'next/head';

export default function ApiDocsEnPage(): React.ReactElement {
  return (
    <>
      <Head>
        <title>API Documentation (EN)</title>
        <meta name="description" content="English version of API documentation" />
      </Head>
      <main style={{ padding: '2rem' }}>
        <h1>API Documentation (EN)</h1>
        <p>This is the English version of the API documentation page.</p>
      </main>
    </>
  );
}
