# MUI Feature Component

A presentational feature component: typed props in `types.ts`, copy from `t(...)`,
shared primitives from the `@/components` barrel, and layout via `sx`. It takes no
data dependency — the container passes state and callbacks in.

```tsx
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';

import { UiButton, UiTypography } from '@/components';

interface SavePanelProps {
  isSaving: boolean;
  onSave: () => void;
}

function SavePanel({ isSaving, onSave }: SavePanelProps): React.ReactElement {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <UiTypography variant="h4" component="h2">
        {t('example.save.title')}
      </UiTypography>
      <UiButton variant="contained" disabled={isSaving} onClick={onSave}>
        {t('example.save.button')}
      </UiButton>
    </Box>
  );
}

export default SavePanel;
```

Keep the copy in `i18n/en.json` and `i18n/uk.json`. For more than a couple of
style fragments, move them into a colocated `styles.ts` and apply via
`sx={styles.panel}` (see reference/mui-emotion-patterns.md).
