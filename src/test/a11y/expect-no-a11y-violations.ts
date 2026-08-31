import type { AxeResults } from 'axe-core';
import { axe } from 'jest-axe';

import {
  FORCED_RULES,
  JSDOM_UNSUPPORTED_RULES,
  WCAG_AA_TAGS,
  filterAllowedViolations,
} from './axe-config';

/**
 * Component-level half of the accessibility gate (issue #317).
 *
 * Runs axe over a rendered React tree in jsdom and fails the test on any WCAG
 * 2.1 AA violation that is not on the reviewed allowlist.
 *
 * This layer covers semantics only — roles, names, states, relationships and
 * labelling. Every criterion that needs layout or paint (contrast, focus
 * appearance, reflow, target size) is unreachable in jsdom and belongs to the
 * route-level scan. A green component test is therefore necessary, never
 * sufficient; see `docs/accessibility/acceptance-standard.md`.
 */
export async function expectNoA11yViolations(container: HTMLElement): Promise<void> {
  // A component that rendered nothing produces no violations, which would
  // otherwise read as a pass. Assert something was actually rendered first, so
  // a failed mock or a swallowed error fails the test instead of greening it.
  expect(container.querySelector('*')).not.toBeNull();

  const results: AxeResults = (await axe(container, {
    runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
    rules: { ...FORCED_RULES, ...JSDOM_UNSUPPORTED_RULES },
  })) as AxeResults;

  const violations = filterAllowedViolations(results.violations, { layer: 'component' });

  // jest-axe's matcher reads `violations` off the results object and renders
  // the rule id, help text and offending markup, so hand it the filtered set
  // rather than re-formatting the failure here.
  expect({ ...results, violations }).toHaveNoViolations();
}
