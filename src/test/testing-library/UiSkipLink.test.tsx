import { render } from '@testing-library/react';

import UiSkipLink from '@/components/ui-skip-link';

import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

/**
 * Coverage contract (AGENTS.md):
 * - Positive: the passed label renders as the link's accessible name and the
 *   href points at the passed target id.
 * - Boundary: a different label/targetId pair renders its own values rather
 *   than a hardcoded default, proving the primitive does not read copy or an
 *   id from anywhere but its props (README.md: primitives never fetch their
 *   own copy).
 * - Permission/auth, loading/error — Not applicable: a static link with no
 *   data dependency and no async state.
 */
describe('UiSkipLink', () => {
  it('renders the passed label as the link text, pointing at the passed target', () => {
    const { getByRole } = render(<UiSkipLink label="Skip to main content" targetId="main" />);

    const link: HTMLElement = getByRole('link', { name: 'Skip to main content' });
    expect(link).toHaveAttribute('href', '#main');
  });

  it('renders a different label/targetId pair without falling back to a default', () => {
    const { getByRole } = render(<UiSkipLink label="Перейти до вмісту" targetId="content" />);

    const link: HTMLElement = getByRole('link', { name: 'Перейти до вмісту' });
    expect(link).toHaveAttribute('href', '#content');
  });

  it('has no WCAG 2.1 AA violations', async () => {
    const { container } = render(<UiSkipLink label="Skip to main content" targetId="main" />);

    await expectNoA11yViolations(container);
  });
});
