/**
 * Integration coverage for the `offline` feature: the body of the offline
 * fallback document (`pages/offline.tsx`, issue #338) rendered through the
 * feature barrel. It is served while the network is down, so it is styled with
 * inline `style` attributes (serialized into the exported HTML) rather than MUI
 * `sx`, and the way back is a plain link that needs no JavaScript — both are
 * asserted here. See `docs/offline-shell.md`.
 *
 * Invalid input / boundary — Not applicable: the component takes no props and
 * reads no state.
 * Loading / error — Not applicable: it renders synchronously with no async
 * boundary.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import colorTheme from '../../../../src/components/ui-color-theme';
import { OfflineShell } from '../../../../src/features/offline';

describe('integration: OfflineShell', () => {
  it('announces the failure as the page heading and explains how it recovers', () => {
    render(<OfflineShell />);

    expect(screen.getByRole('heading', { level: 1, name: t('offline.heading') })).toBeVisible();
    expect(screen.getByText(t('offline.description'))).toBeVisible();
    expect(screen.getByText(t('offline.hint'))).toBeVisible();
  });

  it('offers a way back as a plain link styled inline, so it survives without the runtime', () => {
    render(<OfflineShell />);

    const link: HTMLElement = screen.getByRole('link', { name: t('offline.home_link') });

    expect(link).toHaveAttribute('href', '/');
    expect(link).toHaveAttribute('style');
    expect(link).toHaveStyle({ color: colorTheme.palette.darkPrimary.main });
  });
});
