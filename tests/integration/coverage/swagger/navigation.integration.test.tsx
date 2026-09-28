/**
 * Integration coverage for the swagger `Navigation` component.
 *
 * Imported through the barrel (`components/Navigation/index.ts`) so the
 * re-export executes. Renders the real i18n text and proves the back control is
 * a genuine link to the landing (issue #339): the previous clickable `Box`
 * with `window.location.assign` was neither focusable nor keyboard-operable.
 */
import { render, screen } from '@testing-library/react';
import { t } from 'i18next';

import Navigation from '../../../../src/features/swagger/components/navigation';

const homeLabel = t('navigation.navigate_to_home_page');

describe('integration: swagger Navigation', () => {
  it('renders the back control as a link to the landing named by its text', () => {
    render(<Navigation />);

    const link: HTMLElement = screen.getByRole('link', { name: homeLabel });

    expect(link).toHaveAttribute('href', '/');
    expect(link).not.toHaveAttribute('aria-label');
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
  });

  it('keeps the arrow decorative so it adds nothing to the accessible name', () => {
    const { container } = render(<Navigation />);

    const arrow: HTMLImageElement | null = container.querySelector('img');
    expect(arrow).toHaveAttribute('alt', '');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
