import type { SxProps, Theme } from '@mui/material';

import { bodyLetterSpacing } from '../app-theme';

const root: SxProps<Theme> = { letterSpacing: bodyLetterSpacing };

function toArray(sx: SxProps<Theme> | undefined): ReadonlyArray<SxProps<Theme>> {
  if (sx === undefined) {
    return [];
  }
  return Array.isArray(sx) ? sx : [sx];
}

function withRootTracking(sx: SxProps<Theme> | undefined): SxProps<Theme> {
  return [root, ...toArray(sx)] as SxProps<Theme>;
}

export default { root, withRootTracking };
