import breakpointsTheme from '@/components/UiBreakpoints';

type BreakpointsType = {
  SM: string;
  MD: string;
  LG: string;
  XL: string;
};

export const BREAKPOINTS: BreakpointsType = {
  SM: `${breakpointsTheme.breakpoints.values.sm}px`,
  MD: '769px',
  LG: `${breakpointsTheme.breakpoints.values.lg}px`,
  XL: '1131px',
};

 type DimensionsType = {
  MIN_WIDTH: {
    XS: string;
    SM: string;
    MD: string;
    LG: string;
  };
  MIN_HEIGHT: {
    XS: string;
    SM: string;
    MD: string;
    LG: string;
  };
};

export const DIMENSIONS: DimensionsType = {
  MIN_WIDTH: {
    XS: '21.57rem',
    SM: '39.8rem',
    MD: '39.7rem',
    LG: '31.4rem',
  },
  MIN_HEIGHT: {
    XS: '32rem',
    SM: '42.2rem',
    MD: '42.9rem',
    LG: '40.45rem',
  },
};
