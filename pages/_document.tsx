import { Html, Head, Main, NextScript } from 'next/document';

const mainLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE ?? 'en';

export default function Document(): React.ReactElement {
  return (
    <Html lang={mainLanguage}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="apple-mobile-web-app-title" content="VilnaCRM" />
        <meta name="application-name" content="VilnaCRM" />
        <meta name="theme-color" content="#ffffff" />

        <link rel="icon" type="image/svg+xml" sizes="16x16" href="/layout/favicon/16x16.svg" />
        <link rel="icon" type="image/svg+xml" sizes="32x32" href="/layout/favicon/32x32.svg" />
        <link rel="icon" type="image/svg+xml" sizes="64x64" href="/layout/favicon/64x64.svg" />
        <link rel="icon" type="image/svg+xml" sizes="96x96" href="/layout/favicon/96x96.svg" />
        <link rel="icon" type="image/svg+xml" sizes="128x128" href="/layout/favicon/128x128.svg" />
        <link rel="icon" type="image/svg+xml" sizes="256x256" href="/layout/favicon/256x256.svg" />
        <link rel="icon" type="image/svg+xml" sizes="512x512" href="/layout/favicon/512x512.svg" />
        <link
          rel="icon"
          type="image/svg+xml"
          sizes="1024x1024"
          href="/layout/favicon/1024x1024.svg"
        />

        <link rel="shortcut icon" type="image/svg+xml" href="/layout/favicon/32x32.svg" />

        <link rel="apple-touch-icon" sizes="180x180" href="/layout/favicon/apple-icon.png" />

        <link rel="icon" type="image/x-icon" href="/layout/favicon/favicon.ico" />

        <link
          rel="manifest"
          type="application/manifest+json"
          href="/layout/favicon/site.webmanifest"
        />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
