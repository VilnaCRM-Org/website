import { fireEvent, render } from '@testing-library/react';
import i18n from 'i18next';

import ErrorFallback from '@/components/error-fallback';

import en from '../../features/landing/i18n/en.json';
import uk from '../../features/landing/i18n/uk.json';
import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

// Read from the committed bundle, not the live i18next singleton: a missing
// key echoes back as itself on both sides, so t() would pass vacuously.
const errorBoundaryCopy: typeof en.error_boundary = (i18n.language === 'en' ? en : uk)
  .error_boundary;

/**
 * Coverage contract (AGENTS.md):
 * - Positive: copy, alert/heading roles, home link, retry calls onRetry.
 * - Negative: onRetry not invoked on render alone.
 * - Permission/auth — Not applicable: static fallback, no auth state.
 * - Loading/error — Not applicable: synchronous, no async boundary of its own.
 * - Boundary — Not applicable: onRetry is the only, required input.
 */
describe('ErrorFallback', () => {
  it('renders the localized apology copy', () => {
    const { getByText } = render(<ErrorFallback onRetry={jest.fn()} />);

    expect(getByText(errorBoundaryCopy.title)).toBeInTheDocument();
    expect(getByText(errorBoundaryCopy.description)).toBeInTheDocument();
  });

  it('exposes itself as an alert with a single heading', () => {
    const { getByRole } = render(<ErrorFallback onRetry={jest.fn()} />);

    expect(getByRole('alert')).toBeInTheDocument();
    const heading = getByRole('heading', { level: 1 });
    expect(heading).toHaveTextContent(errorBoundaryCopy.title);
  });

  it('invokes onRetry when the retry control is activated', () => {
    const onRetry = jest.fn();
    const { getByRole } = render(<ErrorFallback onRetry={onRetry} />);

    fireEvent.click(getByRole('button', { name: errorBoundaryCopy.retry_button }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('offers a link back to the homepage', () => {
    const { getByRole } = render(<ErrorFallback onRetry={jest.fn()} />);

    const homeLink = getByRole('link', { name: errorBoundaryCopy.home_link });
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('does not call onRetry when it has not been activated (negative)', () => {
    const onRetry = jest.fn();
    render(<ErrorFallback onRetry={onRetry} />);

    expect(onRetry).not.toHaveBeenCalled();
  });

  it('has no WCAG 2.1 AA violations', async () => {
    const { container } = render(<ErrorFallback onRetry={jest.fn()} />);

    await expectNoA11yViolations(container);
  });
});
