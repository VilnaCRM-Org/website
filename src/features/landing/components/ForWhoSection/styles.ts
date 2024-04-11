import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

import VectorIcon from '../../assets/img/about-vilna/FrameDesktop.png';
import VectorIconMd from '../../assets/img/about-vilna/FrameTablet.png';

export default {
  wrapper: {
    background: colorTheme.palette.backgroundGrey100.main,
    maxWidth: '100dvw',
    overflow: 'hidden',
  },

  lgCardsWrapper: {
    display: 'flex',
    [`@media (max-width: 968px)`]: {
      display: 'none',
    },
  },

  smCardsWrapper: {
    display: 'none',
    [`@media (max-width: 968px)`]: {
      display: 'flex',
      justifyContent: 'center',
    },
  },

  content: {
    pt: '8.25rem',
    position: 'relative',
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.lg}px)`]: {
      pt: '7.375rem',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      pt: '2rem',
    },
  },

  mainImage: {
    backgroundImage: `url(${VectorIcon.src})`,
    backgroundSize: 'contain',
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'center',
    width: '100dvw',
    maxWidth: '50.4rem',
    height: '44.688rem',
    zIndex: '1',
    position: 'absolute',
    top: '3.8%',
    right: '-4.8%',
    '@media (max-width: 1130.98px)': {
      backgroundImage: `url(${VectorIconMd.src})`,
      width: '100dvw',
      maxWidth: '43rem',
      height: '42rem',
      top: '2%',
      right: '-2.9%',
    },
    [`@media (max-width: 968px)`]: {
      maxWidth: '43.75rem',
      height: '44.688rem',
      top: '47%',
      right: '8%',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.md}px)`]: {
      right: '-10%',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      height: '38rem',
      width: '29.5rem',
      top: '38.5%',
    },
    '@media (max-width: 475.98px)': {
      height: '44.688rem',
      right: '-14%',
      width: '26.5rem',
      top: '20%',
    },
    '@media (max-width: 425.98px)': {
      height: '44.688rem',
      right: '-14%',
      width: '26.5rem',
      top: '10%',
    },
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.xs}px)`]: {
      right: '-28%',
      top: '30%',
    },
  },

  line: {
    position: 'relative',
    background: colorTheme.palette.white.main,
    minHeight: '6.25rem',
    zIndex: 1,
    marginTop: '-3.75rem',
    '@media (max-width: 1130.98px)': {
      minHeight: '11.188rem',
      marginTop: '-8.625rem',
    },
    [`@media (max-width: 968px)`]: {
      display: 'none',
    },
  },
};
