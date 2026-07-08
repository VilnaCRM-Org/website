import { NextFont } from 'next/dist/compiled/@next/font';
import localFont from 'next/font/local';

export const golos: NextFont = localFont({
  src: [
    {
      path: '../../assets/fonts/Golos/GolosText-Regular.woff2',
      weight: '400',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Golos/GolosText-Medium.woff2',
      weight: '500',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Golos/GolosText-SemiBold.woff2',
      weight: '600',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Golos/GolosText-Bold.woff2',
      weight: '700',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Golos/GolosText-ExtraBold.woff2',
      weight: '800',
      style: 'normal',
    },
    {
      path: '../../assets/fonts/Golos/GolosText-Black.woff2',
      weight: '900',
      style: 'normal',
    },
  ],
  display: 'swap',
});
