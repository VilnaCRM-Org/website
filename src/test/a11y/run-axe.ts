import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import type { AxeResults, Result } from 'axe-core';

import { FORCED_RULES, WCAG_AA_TAGS } from './axe-config';

/**
 * The one place a browser-side axe run is configured.
 *
 * Both browser layers go through here so the conformance target cannot drift
 * between them:
 *   - routes            — `scan-route.ts` (issue #317), at initial load
 *   - interaction states — `scan-interaction-state.ts` (issue #369), mid-journey
 */

/** Turns a scan label into a filesystem-safe Playwright attachment name. */
export function attachmentSlug(label: string): string {
  const slug: string = label.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '');

  // The landing route is `/`, which slugs to the empty string; name it rather
  // than emitting an attachment whose name is just the prefix.
  return slug === '' ? 'root' : slug.toLowerCase();
}

/**
 * Publishes axe results to the Playwright report as JSON, so a finding that is
 * reported rather than gated is still visible to a human. Attaches nothing when
 * there is nothing to say.
 */
export async function attachAxeResults(name: string, results: readonly Result[]): Promise<void> {
  if (results.length === 0) {
    return;
  }

  await test.info().attach(name, {
    body: JSON.stringify(
      results.map(result => ({
        id: result.id,
        impact: result.impact ?? 'unknown',
        help: result.help,
        helpUrl: result.helpUrl,
        nodes: result.nodes.length,
      })),
      null,
      2
    ),
    contentType: 'application/json',
  });
}

/**
 * Runs the WCAG 2.1 AA rule set against whatever the page currently renders and
 * returns the raw results. Callers decide what is gated; this function only
 * guarantees the run actually happened.
 *
 * `label` identifies the scanned surface in the failure message and in report
 * attachments — a route path, or a route plus the interaction state.
 */
export async function runAxe(page: Page, label: string): Promise<AxeResults> {
  // `options()` replaces the builder's option object wholesale, so the tag
  // filter and the rule overrides must be set in the same call — chaining
  // `withTags().options()` would silently discard the tags.
  const results: AxeResults = await new AxeBuilder({ page })
    .options({
      runOnly: { type: 'tag', values: [...WCAG_AA_TAGS] },
      rules: FORCED_RULES,
    })
    .analyze();

  // A scan that found nothing to analyse must fail, not pass silently: zero
  // evaluated rules means the page never rendered, not that it is accessible.
  expect(
    results.passes.length + results.violations.length + results.incomplete.length,
    `axe evaluated no rules on ${label} — the page almost certainly failed to render`
  ).toBeGreaterThan(0);

  // `incomplete` means axe could not decide — typically contrast over a
  // gradient or an image. It is advisory by construction, so it is published
  // for human review rather than gated on; see the acceptance standard.
  await attachAxeResults(`axe-incomplete-${attachmentSlug(label)}`, results.incomplete);

  return results;
}
