import { NextFont } from 'next/dist/compiled/@next/font';
import localFont from 'next/font/local';

export const inter: NextFont = localFont({
  src: [
    {
      path: '../../assets/fonts/Inter/Inter-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Inter/Inter-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Inter/Inter-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
  ],
  display: 'swap',
});
