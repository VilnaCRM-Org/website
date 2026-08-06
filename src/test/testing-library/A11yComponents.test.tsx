import { ThemeProvider } from '@mui/material';
import { render, RenderResult } from '@testing-library/react';
import React from 'react';

import { UiButton, UiCheckbox, UiInput, UiLink, UiTypography } from '@/components';
import { theme } from '@/components/app-theme';

import { expectNoA11yViolations } from '../a11y/expect-no-a11y-violations';

import { testText } from './constants';
import renderAuthForm from './fixtures/auth-form-helper';

/**
 * Component-level accessibility gate (issue #317).
 *
 * Each case renders a component the way the product renders it and asserts
 * zero WCAG 2.1 AA violations, giving the per-rule contract that neither the
 * Lighthouse accessibility *category* score nor a static jsx-a11y lint pass
 * can provide. It runs on every PR through the existing client unit suite and
 * through `make test-a11y`.
 *
 * Scope reminder: jsdom has no layout or paint engine, so this layer covers
 * semantics only — roles, names, states and relationships. Contrast, focus
 * appearance and reflow are asserted by the route-level scan.
 */

function renderThemed(ui: React.ReactElement): RenderResult {
  return render(<ThemeProvider theme={theme}>{ui}</ThemeProvider>);
}

describe('component accessibility (WCAG 2.1 AA)', () => {
  it('UiButton has no violations', async () => {
    const { container } = renderThemed(<UiButton type="button">{testText}</UiButton>);

    await expectNoA11yViolations(container);
  });

  it('UiButton rendered as a link has no violations', async () => {
    const { container } = renderThemed(<UiButton href="#signUp">{testText}</UiButton>);

    await expectNoA11yViolations(container);
  });

  it('UiButton has no violations when disabled', async () => {
    const { container } = renderThemed(
      <UiButton type="button" disabled>
        {testText}
      </UiButton>
    );

    await expectNoA11yViolations(container);
  });

  it('UiInput has no violations when labelled', async () => {
    const { container } = renderThemed(
      <>
        <label htmlFor="a11y-email">{testText}</label>
        <UiInput id="a11y-email" type="email" placeholder={testText} />
      </>
    );

    await expectNoA11yViolations(container);
  });

  it('UiCheckbox has no violations', async () => {
    const { container } = renderThemed(<UiCheckbox label={testText} onChange={jest.fn()} />);

    await expectNoA11yViolations(container);
  });

  it('UiLink has no violations', async () => {
    const { container } = renderThemed(<UiLink href="https://vilnacrm.com">{testText}</UiLink>);

    await expectNoA11yViolations(container);
  });

  it('UiTypography rendered as a heading has no violations', async () => {
    const { container } = renderThemed(
      <UiTypography component="h1" variant="h1">
        {testText}
      </UiTypography>
    );

    await expectNoA11yViolations(container);
  });

  it('AuthForm has no violations', async () => {
    const { container } = renderAuthForm();

    await expectNoA11yViolations(container);
  });
});
