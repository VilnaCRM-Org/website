import { SxProps, Theme } from '@mui/material';

import { media, mq } from '@/components/UiBreakpoints/Theme/media';  
import colorTheme from '@/components/UiColorTheme'; 
 
type PointBaseReturn = {  
  [key: string]: unknown;  
  width: string;  
  height: string;  
  
};  
const pointBase: (width: string, height: string) => PointBaseReturn = (width: string, height: string): PointBaseReturn => ({  
  width,  
  height,  
  [media.md]: { width: '0.45rem' },  
});  


const arrowCommon: SxProps<Theme> = {
  position: 'absolute',
  marginTop: '4.2rem',
  [media.sm]: { marginTop: '4.4rem' },
  [media.md]: { marginTop: '4.9rem' },
};

export default {
  wrapper: {
    background: colorTheme.palette.backgroundGrey100.main,
    maxWidth: '100dvw',
    overflow: 'hidden',
  },

  lgCardsWrapper: {
    display: 'flex',
  [mq.max968]: { display: 'none' },  
  },

  smCardsWrapper: {
    display: 'none',
  [media.custom.max968]: { display: 'flex', justifyContent: 'center' },  
  },

  content: {
    pt: '8.25rem',
    position: 'relative',
  [media.lg]: { pt: '7.375rem' },  
  [media.sm]: { pt: '2rem' },
  },

  line: {
    position: 'relative',
    background: colorTheme.palette.white.main,
    minHeight: '6.25rem',
    zIndex: 1,
    [media.custom.max1131]: { minHeight: '11.188rem', marginTop: '-8.625rem' },  
    [mq.max968]: { display: 'none' },  
  },

  container: {
    position: 'relative',
    marginTop: '1.5rem',
    marginBottom: '-6rem',
    display: 'flex',
    [mq.min426]: {
      justifyContent: 'center',
      marginTop: '0',
      marginLeft: 'auto',
      marginRight: 'auto',
      width: 'auto',
      maxWidth: '100%',
      flexGrow: 1,
      transform: 'scale(1.1)',
    },
    [media.md]: { marginTop: '1rem', transform: 'none' },
    [mq.min641]: {
      marginTop: '-8rem',
      width: '85vw',
      maxWidth: '1000px',
      transform: 'scale(1.1)',
    },
    [mq.min969]: {
      width: 'auto',
      transform: 'none',
      marginRight: '0',
      marginTop: '-30rem',
      marginLeft: '17.6rem',
    },
    [mq.min1131]: { marginTop: '-27.2rem', marginLeft: '38.2rem' },
  },

  svgContainer: {
    [mq.min969]: { marginTop: '-15rem' },
  },

  circle: {
    width: '0.5rem',
    height: '0.5rem',
    marginTop: '5.1rem',
    marginLeft: '1.5rem',
    [mq.min468]: { position: 'absolute' },
    [media.sm]: {
      width: '0.8rem',
      height: '0.8rem',
      marginTop: '2.9rem',
      marginLeft: '1.5rem',
    },
    [mq.min969]: { marginTop: '2rem', marginLeft: '2rem' },
    [mq.min1131]: { marginTop: '1.9rem', marginLeft: '-9.4rem' },
  },

  rhombus: {
    ...pointBase('1.5rem', '1.5rem'),
    marginTop: '9.1rem',
    marginLeft: '1.1rem',
    [mq.min468]: { position: 'absolute', marginTop: '15rem' },
    [media.sm]: { width: '2rem', height: '2rem', marginTop: '16rem', marginLeft: '0.5rem' },
    [mq.min969]: { marginTop: '18.9rem', marginLeft: '1.3rem' },
    [mq.min1131]: { marginTop: '19rem', marginLeft: '-8.5rem', zIndex: 1 },
  },

  pointContainer: {
    display: 'flex',
    marginTop: '0.5rem',
    marginLeft: '0.5rem',
    [mq.min468]: { marginTop: '17rem' },
    [media.sm]: { marginTop: '22rem', marginLeft: '1.5rem' },
    [mq.min641]: { marginLeft: '0' },
    [mq.min969]: { marginTop: '22.4rem', marginLeft: '1.4rem' },
    [mq.min1131]: { position: 'absolute', marginTop: '22.6rem', marginLeft: '-13rem' },
  },

  pointGroup: {
    display: 'none',
    [mq.min1131]: { display: 'block', marginTop: '4rem', marginLeft: '-0.2rem' },
  },

  point6: {
    marginLeft: '0.9rem',
    marginTop: '1rem',
    [media.sm]: { width: '0.40rem', height: 'auto', marginTop: '0' },
    [mq.min641]: { marginTop: '0.1rem' },
    [media.md]: { width: '0.45rem', marginLeft: '-0.2rem' },
    [mq.min969]: { width: '0.43rem', marginLeft: '0.4rem', marginTop: '0.18rem' },
    [mq.min1131]: { marginTop: '0.23rem', marginLeft: '0.4rem' },
  },

  point8: {
    marginLeft: '0.2rem',
    marginTop: '0.55rem',
    [media.sm]: { width: '0.40rem', marginLeft: '0.3rem' },
    [mq.min641]: { marginTop: '0', marginLeft: '0.4rem' },
    [media.md]: { width: '0.45rem' },
    [mq.min969]: { width: '0.43rem', marginLeft: '0.38rem', marginTop: '0.15rem' },
    [mq.min1131]: { marginTop: '0.21rem', marginLeft: '0.5rem' },
  },

  point10: {
    marginLeft: '0.2rem',
    [media.sm]: { width: '0.40rem' },
    [media.md]: { width: '0.45rem' },
    [mq.min969]: { width: '0.43rem', marginTop: '0.2rem' },
    [mq.min1131]: { marginLeft: '0.3rem' },
  },

  square: {
    width: '35rem',
    height: '19.6rem',
    marginTop: '6.6rem',
    marginLeft: '0.6rem',
    backgroundColor: colorTheme.palette.primary.main,
    borderRadius: '6%',
    zIndex: 0,
    [mq.min426]: { width: '22rem', height: '20rem' },
    [media.sm]: { width: '26.5rem', height: '22rem' },
    [media.md]: { width: '38rem', height: '29.7rem', marginLeft: '1.5rem' },
    [mq.min969]: { width: '37.6rem', height: '40.5rem', marginTop: '-10.6rem', marginLeft: '1.2rem' },
    [mq.min1131]: { marginLeft: '-1.3rem' },
  },

  bigScreen: {
    width: '18.5rem',
    height: '12.8rem',
    marginTop: '-2.8rem',
    marginLeft: '1.2rem',
    zIndex: 1,
    borderRadius: '0.6rem',
    boxShadow: '0px 24px 48px rgba(0, 0, 0, 0.15), 0px 12px 24px rgba(0, 0, 0, 0.1)', 
    [media.sm]: { width: '22rem', height: '16rem', marginTop: '-4.3rem' },
    [media.md]: { width: '31.6rem', height: '20.5rem', marginTop: '-5rem', marginLeft: '1.5rem' },
    [mq.min969]: { width: '31.6rem', height: '21.7rem', marginTop: '-4.4rem', marginLeft: '1.5rem' },
    [mq.min1131]: { marginLeft: '-1rem' },
  },

  smallScreen: {
    width: '15.2rem',
    height: '12.8rem',
    marginTop: '5.5rem',
    marginLeft: '-1.7rem',
    borderRadius: '0.6rem',
    boxShadow:
      '0px 24px 48px rgba(0, 0, 0, 0.15), 0px 12px 24px rgba(0, 0, 0, 0.1)',
    [media.sm]: { width: '18.6rem', height: '15.8rem', marginTop: '3.7rem', marginLeft: '-1.3rem' },
    [media.md]: { width: '21.9rem', height: '15.8rem', marginTop: '3.7rem', marginLeft: '-1rem' },
    [mq.min969]: { width: '21.9rem', height: '16rem', marginTop: '3.7rem', marginLeft: '-1rem' },
    [mq.min1131]: { marginLeft: '-3rem' },
  },

  whiteStripe: {
    position: 'absolute',
    background: colorTheme.palette.white.main,
    borderRadius: '1rem',
    width: '7.2rem',
    height: '0.7rem',
    marginTop: '3.5rem',
    marginLeft: '12.4rem',
    [media.sm]: { width: '7.8rem', marginLeft: '13.4rem', marginTop: '3.6rem' },
    [media.md]: { width: '11.4rem', marginLeft: '18rem', marginTop: '3.9rem' },
    [mq.min969]: { width: '12.4rem', marginLeft: '18rem', marginTop: '4.1rem' },
    [mq.min1131]: { marginLeft: '13.3rem', marginTop: '3.7rem' },
  },

  arrowBig: {
    ...arrowCommon,
    width: '3.2rem',
    height: '3.5rem',
    marginLeft: '20rem',
    [media.sm]: { width: '3.5rem', height: '3.7rem', marginLeft: '21rem' },
    [media.md]: { width: '4.8rem', height: '5.4rem', marginLeft: '27.7rem', marginTop: '4.9rem' },
    [mq.min969]: { marginTop: '5rem', marginLeft: '27.3rem' },
    [mq.min1131]: { marginLeft: '22rem' },
  },

  arrowSmall: {
    position: 'absolute',
    width: '2.5rem',
    height: '2.5rem',
    marginTop: '5rem',
    marginLeft: '15.5rem',
    [media.sm]: { width: '2.6rem', height: '2.6rem', marginTop: '4.4rem', marginLeft: '17rem' },
    [media.md]: { marginTop: '4.7rem', marginLeft: '19rem' },
    [mq.min969]: { marginTop: '4.7rem', marginLeft: '18.4rem' },
    [mq.min1131]: { marginLeft: '13rem' },
  },
};
