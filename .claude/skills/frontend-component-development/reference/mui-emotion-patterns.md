# MUI and Emotion Patterns

This repo styles with MUI 9 and Emotion. The dominant pattern is the `sx` prop
fed from a colocated `styles.ts`, not inline literals scattered through JSX.

## Colocate styles in `styles.ts`

`styles.ts` default-exports a plain object of style fragments. Keep static
styles out of render so they are not re-created on every pass, and pull theme
values from the shared theme primitives instead of hardcoding.

```ts
import breakpointsTheme from '@/components/UiBreakpoints';
import colorTheme from '@/components/UiColorTheme';

export default {
  title: {
    color: colorTheme.palette.darkPrimary.main,
    marginBottom: '1rem',
  },
  panel: {
    display: 'grid',
    gap: 2,
    [`@media (max-width: ${breakpointsTheme.breakpoints.values.sm}px)`]: {
      gap: 1,
    },
  },
};
```

Apply the fragments through `sx`:

```tsx
import { Box } from '@mui/material';

import { UiTypography } from '@/components';

import styles from './styles';

function Panel(): React.ReactElement {
  return (
    <Box sx={styles.panel}>
      <UiTypography variant="h5" component="h2" sx={styles.title}>
        Section
      </UiTypography>
    </Box>
  );
}

export default Panel;
```

## Theme tokens

The shared theme primitives are created with MUI `createTheme`
(`UiColorTheme`, `UiBreakpoints`). Prefer their palette and breakpoint values
over raw hex codes and pixel literals so the design stays consistent.

Reach for `styled` from `@mui/material` only when a styled wrapper is reused
across several call sites; for one-off layout, `sx` plus `styles.ts` is simpler.

## Icons and images

There is no `@mui/icons-material` dependency — do not add one. Icons and imagery
are SVG assets stored under the feature's `assets/` and rendered through the
optimized `Image` component (`next-export-optimize-images/image`) or the shared
`UiImage` primitive. Always pass a translated `alt` so icon-only imagery stays
accessible.

```tsx
import Image from 'next-export-optimize-images/image';
import { useTranslation } from 'react-i18next';

import questionMark from '../../assets/svg/question-mark.svg';

function HelpIcon(): React.ReactElement {
  const { t } = useTranslation();

  return <Image src={questionMark} alt={t('form.help.alt')} width={16} height={16} />;
}

export default HelpIcon;
```
