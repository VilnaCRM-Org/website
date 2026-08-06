import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

import {
  FORCED_RULES,
  WCAG_AA_TAGS,
  describeViolations,
  filterAllowedViolations,
} from './axe-config';

/**
 * Route-level half of the accessibility gate (issue #317).
 *
 * Runs axe against a fully rendered route in a real browser and fails on any
 * WCAG 2.1 AA violation that is not on the reviewed allowlist. Unlike the
 * Lighthouse accessibility *category* score, this asserts per rule, so a
 * regression cannot be averaged away.
 *
 * There is deliberately no `if (count > 0)` style guard anywhere in this path:
 * a scan that finds nothing to analyse must fail, not pass silently.
 */
export async function scanRoute(page: Page, route: string): Promise<void> {
  // `options()` replaces the builder's option object wholesale, so the tag
  // filter and the rule overrides must be set in the same call — chaining
  // `withTags().options()` would silently discard the tags.
  const results = await new AxeBuilder({ page })
    .options({
      runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
      rules: FORCED_RULES,
    })
    .analyze();

  expect(
    results.passes.length + results.violations.length + results.incomplete.length,
    `axe evaluated no rules on ${route} — the page almost certainly failed to render`
  ).toBeGreaterThan(0);

  const violations = filterAllowedViolations(results.violations, { layer: 'route', route });

  // Assert on the rule ids rather than the raw axe results: the diff stays
  // readable, and `describeViolations` supplies the rule, impact, help URL and
  // every offending selector as the failure message.
  expect(
    violations.map(violation => violation.id),
    describeViolations(violations)
  ).toEqual([]);
}
