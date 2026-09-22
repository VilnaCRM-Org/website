import { fireEvent, render } from '@testing-library/react';
import i18n from 'i18next';

import ErrorFallback from '@/components/error-fallback';

import en from '../../features/landing/i18n/en.json';
import uk from '../../features/landing/i18n/uk.json';
import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

// The committed bundle is the reference, not the live i18next singleton the
// component itself reads from: i18next echoes a missing key back as the key
// string on both sides, so resolving t() here too would pass even if the key
// were deleted from both bundles.
const errorBoundaryCopy: typeof en.error_boundary = (i18n.language === 'en' ? en : uk)
  .error_boundary;

/**
 * Coverage contract (AGENTS.md):
 * - Positive: localized copy renders, the alert/heading roles are exposed, the
 *   home link points at "/", and clicking the retry control invokes `onRetry`.
 * - Negative: `onRetry` is not invoked on render alone.
 * - Permission/auth — Not applicable: a static fallback, no authenticated state.
 * - Loading/error — Not applicable: renders synchronously with no async boundary
 *   of its own (the crash it responds to is handled by the caller's
 *   Sentry.ErrorBoundary in pages/_app.tsx).
 * - Boundary — Not applicable: `onRetry` is the component's only input and is a
 *   required callback, so there is no size/length/empty-value boundary to probe.
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
