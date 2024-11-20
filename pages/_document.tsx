import { Html, Head, Main, NextScript } from 'next/document';

const mainLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

export default function Document(): React.ReactElement {
  return (
    <Html lang={mainLanguage}>
      <Head>
        <link rel="icon" href="/favicon.png" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
