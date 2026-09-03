import { expect, type Page } from '@playwright/test';
import type { AxeResults } from 'axe-core';

import {
  BLOCKING_IMPACTS,
  describeViolations,
  filterAllowedViolations,
  partitionByImpact,
  type ImpactPartition,
} from './axe-config';
import type { A11yInteractionState } from './interaction-states';
import { attachAxeResults, attachmentSlug, runAxe } from './run-axe';

/**
 * Interaction-state accessibility scan (issue #369).
 *
 * Call this from an existing e2e journey once the state under test is on screen.
 * It asserts the composed DOM against WCAG 2.1 AA and fails the journey on any
 * serious or critical violation that is not on the reviewed allowlist.
 *
 * Two deliberate differences from the route-level scan (`scan-route.ts`):
 *
 *   - Only serious/critical impacts are gated. Moderate and minor findings are
 *     attached to the Playwright report instead, so an always-on scan inside a
 *     behavioural journey cannot red the suite over an advisory heuristic. See
 *     `BLOCKING_IMPACTS` for why.
 *   - The exception context is the state's route, so a waiver reviewed for that
 *     page applies to every state on it — and to no other page.
 *
 * There is no `if (visible)` guard here, and callers must not add one: the state
 * is asserted visible by the journey before the scan runs, so a scan that finds
 * nothing to analyse is a broken page, not a pass.
 */
export async function scanInteractionState(page: Page, state: A11yInteractionState): Promise<void> {
  const label: string = `${state.route} — ${state.description}`;

  const results: AxeResults = await runAxe(page, label);

  const violations = filterAllowedViolations(results.violations, {
    layer: 'route',
    route: state.route,
  });

  const { blocking, advisory }: ImpactPartition = partitionByImpact(violations);

  await attachAxeResults(`axe-advisory-${attachmentSlug(label)}`, advisory);

  // Assert on the rule ids so the diff stays readable; `describeViolations`
  // supplies the rule, impact, help URL and every offending selector.
  expect(
    blocking.map(violation => violation.id),
    `${label}: ${BLOCKING_IMPACTS.join('/')} violations\n${describeViolations(blocking)}`
  ).toEqual([]);
}
