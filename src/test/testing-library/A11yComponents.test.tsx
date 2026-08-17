import { ThemeProvider } from '@mui/material';
import { render, RenderResult } from '@testing-library/react';
import type { AxeResults, RuleObject } from 'axe-core';
import { axe } from 'jest-axe';
import React from 'react';

import { UiButton, UiCheckbox, UiInput, UiLink, UiTypography } from '@/components';
import { theme } from '@/components/app-theme';

import { FORCED_RULES, JSDOM_UNSUPPORTED_RULES, WCAG_AA_TAGS } from '../a11y/axe-config';
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

  // `label-content-name-mismatch` is the only rule axe tags `wcag21a`, and axe
  // suppresses it by default as experimental — so without the FORCED_RULES
  // override the whole tag matches nothing that runs. Asserting tag membership
  // is not enough; this proves the override actually puts the rule in the run.
  it('force-enables label-content-name-mismatch, which axe would otherwise skip', async () => {
    const { container } = renderThemed(
      <UiButton type="button" aria-label="Close">
        Save changes
      </UiButton>
    );

    // `JSDOM_UNSUPPORTED_RULES` is merged into every run here for the same reason
    // `expectNoA11yViolations` applies it: a tag-based `runOnly` overrides axe's
    // global `enabled` flag, so without it `color-contrast` and
    // `link-in-text-block` execute in jsdom, land in `incomplete`, and emit
    // `Not implemented: HTMLCanvasElement.prototype.getContext`. This test runs
    // axe twice, so the noise was doubled — and a meta-test that validates the
    // gate config has to use it, not diverge from it. It cannot affect the
    // assertions below: neither colour rule is `label-content-name-mismatch`.
    //
    // One `getContext` warning survives on purpose. It comes from
    // `_isIconLigature` inside `label-content-name-mismatch` itself — the rule
    // under test renders the label text to a canvas to decide whether it is an
    // icon ligature. Silencing that one would mean disabling the rule this test
    // exists to prove is running.
    const evaluatedRules: (rules?: RuleObject) => Promise<string[]> = async rules => {
      const results: AxeResults = (await axe(container, {
        runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
        rules: { ...JSDOM_UNSUPPORTED_RULES, ...rules },
      })) as AxeResults;

      return [...results.violations, ...results.passes, ...results.incomplete].map(
        result => result.id
      );
    };

    expect(await evaluatedRules()).not.toContain('label-content-name-mismatch');
    expect(await evaluatedRules(FORCED_RULES)).toContain('label-content-name-mismatch');
  });
});
