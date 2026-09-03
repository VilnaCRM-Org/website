import { expect, type Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

import { describeViolations, filterAllowedViolations } from './axe-config';
import { runAxe } from './run-axe';

/**
 * Route-level half of the accessibility gate (issue #317).
 *
 * Runs axe against a fully rendered route in a real browser and fails on any
 * WCAG 2.1 AA violation that is not on the reviewed allowlist. Unlike the
 * Lighthouse accessibility *category* score, this asserts per rule, so a
 * regression cannot be averaged away.
 *
 * Every impact level is gated here. The narrower serious/critical gate belongs
 * to the interaction-state scans (`scan-interaction-state.ts`), which run inside
 * behavioural journeys; this layer owns the full standard at initial load.
 *
 * There is deliberately no `if (count > 0)` style guard anywhere in this path:
 * a scan that finds nothing to analyse must fail, not pass silently.
 */
export async function scanRoute(page: Page, route: string): Promise<void> {
  const results: AxeResults = await runAxe(page, route);

  const violations = filterAllowedViolations(results.violations, { layer: 'route', route });

  // Assert on the rule ids rather than the raw axe results: the diff stays
  // readable, and `describeViolations` supplies the rule, impact, help URL and
  // every offending selector as the failure message.
  expect(
    violations.map(violation => violation.id),
    describeViolations(violations)
  ).toEqual([]);
}
