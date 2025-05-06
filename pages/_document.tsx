import { Html, Head, Main, NextScript } from 'next/document';

const mainLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE as string;

export default function Document(): React.ReactElement {
  return (
    <Html lang={mainLanguage}>
      <Head>
        <meta name="apple-mobile-web-app-title" content="VilnaCRM" />
        <meta name="application-name" content="VilnaCRM" />
        <meta name="theme-color" content="#ffffff" />

        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/layout/favicon/16х16.svg" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/layout/favicon/32х32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="64x64" href="/layout/favicon/64х64.svg" />
        <link rel="icon" type="image/svg+xml" sizes="96x96" href="/layout/favicon/96х96.svg" />
        <link rel="icon" type="image/svg+xml" sizes="128x128" href="/layout/favicon/128х128.svg" />
        <link rel="icon" type="image/svg+xml" sizes="256x256" href="/layout/favicon/256х256.svg" />
        <link rel="icon" type="image/svg+xml" sizes="512x512" href="/layout/favicon/512х512.svg" />
        <link
          rel="icon"
          type="image/svg+xml"
          sizes="1024x1024"
          href="/layout/favicon/1024х1024.svg"
        />

        <link rel="shortcut icon" href="/layout/favicon/32х32.svg" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
