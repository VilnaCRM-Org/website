/**
 * Integration: AppTheme barrel.
 *
 * Importing the module executes `createTheme(...)` with the real
 * UiBreakpoints / UiColorTheme inputs, covering `src/components/AppTheme/index.ts`.
 */
import { theme } from '@/components/app-theme';

describe('AppTheme', () => {
  it('builds a MUI theme with the configured breakpoints, palette and overrides', () => {
    expect(theme).toBeDefined();
    expect(theme.breakpoints).toBeDefined();
    expect(theme.palette).toBeDefined();
    expect(theme.components?.MuiContainer?.styleOverrides?.root).toBeDefined();
  });
});
