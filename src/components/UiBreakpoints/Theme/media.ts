import breakpointsTheme from '@/components/UiBreakpoints';

const bp: { xs: number; sm: number; md: number; lg: number; xl: number } =
  breakpointsTheme.breakpoints.values;

export const media: {
  xs: string;
  sm: string;
  md: string;
  lg: string;
  xl: string;
  custom: {
    max320: string;
    min426: string;
    min468: string;
    min641: string;
    max968: string;
    min969: string;
    max1131: string;
    min1131: string;
  };
} = {
  xs: `@media (min-width: ${bp.xs}px)`,
  sm: `@media (min-width: ${bp.sm}px)`,
  md: `@media (min-width: ${bp.md}px)`,
  lg: `@media (min-width: ${bp.lg}px)`,
  xl: `@media (min-width: ${bp.xl}px)`,

 
  custom: {
    max320: '@media (max-width: 320px)',
    min426: '@media (min-width: 426px)',
    min468: '@media (min-width: 468px)',
    min641: '@media (min-width: 641px)',
    max968: '@media (max-width: 968px)',
    min969: '@media (min-width: 969px)',
    max1131: '@media (max-width: 1131px)',
    min1131: '@media (min-width: 1131px)',
  }
};

export const mq: typeof media.custom = media.custom;
