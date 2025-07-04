import { Html, Head, Main, NextScript } from 'next/document';

const mainLanguage: string = process.env.NEXT_PUBLIC_MAIN_LANGUAGE ?? 'en';

export default function Document(): React.ReactElement {
  return (
    <Html lang={mainLanguage}>
      <Head>
        <meta charSet="utf-8" />
        <meta name="description" content="VilnaCRM platform for customer relationship management" />
        <meta name="apple-mobile-web-app-title" content="VilnaCRM" />
        <meta name="application-name" content="VilnaCRM" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="msapplication-config" content="/layout/favicon/browserconfig.xml" />

        {/* Font preloading */}
        <link
          rel="preload"
          href="/assets/fonts/Golos/GolosText-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Golos/GolosText-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Golos/GolosText-SemiBold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Golos/GolosText-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Inter/Inter-Regular.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Inter/Inter-Medium.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href="/assets/fonts/Inter/Inter-Bold.woff2"
          as="font"
          type="font/woff2"
          crossOrigin="anonymous"
        />

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

        <link rel="apple-touch-icon" sizes="180x180" href="/layout/favicon/apple-touch-icon.png" />
        <link rel="mask-icon" href="/layout/favicon/safari-pinned-tab.svg" color="#ffffff" />

        <link rel="icon" type="image/x-icon" sizes="any" href="/layout/favicon/favicon.ico" />
        <link rel="icon" type="image/svg+xml" href="/layout/favicon/favicon.svg" />
        <link rel="icon" type="image/png" href="/layout/favicon/favicon-96x96.png" sizes="96x96" />

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
