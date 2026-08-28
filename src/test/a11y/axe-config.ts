import type { NodeResult, Result, RuleObject } from 'axe-core';

import { A11Y_ROUTES } from './routes';

/**
 * Single source of truth for the accessibility acceptance standard
 * (`docs/accessibility/acceptance-standard.md`, issue #317).
 *
 * Both a11y layers import from this module so the conformance target cannot
 * drift between them:
 *   - component level — `expect-no-a11y-violations.ts` (jest-axe, jsdom)
 *   - route level     — `scan-route.ts` (@axe-core/playwright, real browsers)
 *
 * No spec may re-declare the tag list or the allowlist inline.
 */

/**
 * The axe tags that make up the binding gate: WCAG 2.1 Level AA.
 *
 * `best-practice` is deliberately NOT included. Those rules are axe's own
 * advisory heuristics, not WCAG success criteria — gating on them would fail
 * the suite for reasons that have no bearing on the stated conformance target.
 *
 * `wcag22aa` and the AAA tags are out of scope for the same reason: the
 * standard this repo commits to is WCAG 2.1 AA. Raising the target is a
 * deliberate change to `docs/accessibility/acceptance-standard.md`, not a
 * silent tag edit.
 */
export const WCAG_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

/**
 * Rules that carry a WCAG 2.1 AA tag but are suppressed by axe's default
 * `tagExclude: ['experimental', 'deprecated']`, so a tag-based run would never
 * execute them. The `rules` run option is evaluated before the tag filter, so
 * naming them here is what actually puts them in the gate.
 *
 * `label-content-name-mismatch` is the reason this exists: it is the ONLY rule
 * in axe-core carrying `wcag21a`, so without this override the `wcag21a` tag
 * matches nothing that runs. `td-has-header` and `table-fake-caption` cover
 * WCAG 1.3.1 on data tables, which the Swagger page renders.
 *
 * Deliberately NOT force-enabled: `p-as-heading` (heuristic; trips on MUI
 * subtitle typography), `css-orientation-lock` (parses every stylesheet and
 * reports non-deterministic `incomplete` results), and the two `deprecated`
 * rules `aria-roledescription` / `audio-caption`.
 */
export const FORCED_RULES: RuleObject = {
  'label-content-name-mismatch': { enabled: true },
  'table-fake-caption': { enabled: true },
  'td-has-header': { enabled: true },
};

/**
 * Rules that cannot produce a trustworthy result under jsdom, which has no
 * layout or paint engine. jest-axe disables these through axe's *global*
 * `enabled` flag, but a tag-based `runOnly` overrides that flag — so without
 * this they would run anyway, report `incomplete`, and spam
 * `Not implemented: HTMLCanvasElement.prototype.getContext`.
 *
 * `link-in-text-block` is covered for real by the route-level scan, which drives
 * Chromium, Firefox and WebKit. `color-contrast` runs there too, but every node
 * it reports is dropped by the `*`-scoped route exception below, so SC 1.4.3 is
 * enforced at neither layer until #423 lands.
 */
export const JSDOM_UNSUPPORTED_RULES: RuleObject = {
  'color-contrast': { enabled: false },
  'link-in-text-block': { enabled: false },
};

/** Scope value that applies an exception to every node the rule reports. */
export const EXCEPTION_SCOPE_ANY = '*';

/** Which half of the gate an exception applies to. */
export type A11yLayer = 'component' | 'route';

/**
 * An accepted, reviewed accessibility exception.
 *
 * Every field is mandatory: an exception is only auditable if a reader can see
 * which rule is waived, how far the waiver reaches, why it was accepted, and
 * where the debt is tracked. `findInvalidExceptions` enforces that, and
 * `src/test/unit/a11y/axe-config.test.ts` asserts it over the real allowlist —
 * so an incomplete or unbounded entry fails CI instead of silently widening
 * the gate.
 */
export interface A11yException {
  /** axe rule id, e.g. `color-contrast`. */
  readonly ruleId: string;
  /**
   * CSS selector the waiver is limited to, matched against the start of the
   * failing node's selector chain, or `EXCEPTION_SCOPE_ANY` for every node.
   */
  readonly scope: string;
  /** Which layer the waiver applies to. */
  readonly layer: A11yLayer;
  /**
   * Registered route paths the waiver covers. Required for `route` exceptions
   * so a waiver can never leak onto a route nobody reviewed it for; omitted
   * for `component` exceptions.
   */
  readonly routes?: readonly string[];
  /** Why the violation is accepted rather than fixed. */
  readonly reason: string;
  /** GitHub issue tracking the accepted debt. */
  readonly trackingUrl: string;
}

/**
 * The reviewed allowlist. Every entry is accepted debt with an owning issue,
 * never a way to silence a new regression — adding one is a reviewed change
 * per the acceptance standard, never an inline disable, an axe rule removal,
 * or a skipped test.
 */
export const A11Y_EXCEPTIONS: readonly A11yException[] = [
  {
    ruleId: 'color-contrast',
    scope: EXCEPTION_SCOPE_ANY,
    layer: 'route',
    routes: ['/', '/swagger', '/en/docs/api'],
    reason:
      'The brand palette fails SC 1.4.3 at ten distinct token pairs (measured in #423). ' +
      'Fixing it changes shared design tokens and regenerates every visual baseline, ' +
      'which is a design decision outside the scope of the gate that found it. Scoped ' +
      'to the three routes it was measured against, so a new page still fails closed.',
    trackingUrl: 'https://github.com/VilnaCRM-Org/website/issues/423',
  },
  {
    ruleId: 'select-name',
    scope: '#servers',
    layer: 'route',
    routes: ['/swagger'],
    reason:
      'The servers dropdown is rendered by third-party swagger-ui-react, so there is no ' +
      'local element to label; tracked in #424. Scoped to that one selector, so the same ' +
      'rule still fails on every other control.',
    trackingUrl: 'https://github.com/VilnaCRM-Org/website/issues/424',
  },
];

const TRACKING_URL_PATTERN = /^https:\/\/github\.com\/VilnaCRM-Org\/website\/issues\/\d+$/;

const KNOWN_ROUTE_PATHS: readonly string[] = A11Y_ROUTES.map(route => route.path);

const isBlank: (value: string) => boolean = value => value.trim().length === 0;

function findExceptionProblems(exception: A11yException, label: string): string[] {
  const problems: string[] = [];

  if (isBlank(exception.ruleId)) {
    problems.push(`${label} is missing an axe rule id`);
  }
  if (isBlank(exception.scope)) {
    problems.push(`${label} is missing a scope (use "${EXCEPTION_SCOPE_ANY}" for every node)`);
  }
  if (isBlank(exception.reason)) {
    problems.push(`${label} is missing a reason`);
  }
  if (!TRACKING_URL_PATTERN.test(exception.trackingUrl)) {
    problems.push(`${label} must link a tracking issue on VilnaCRM-Org/website`);
  }

  return problems;
}

function findRouteProblems(exception: A11yException, label: string): string[] {
  if (exception.layer !== 'route') {
    return exception.routes === undefined
      ? []
      : [`${label} is a component exception and must not list routes`];
  }

  const routes = exception.routes ?? [];

  if (routes.length === 0) {
    return [`${label} must list the route paths it covers`];
  }

  return routes
    .filter(route => !KNOWN_ROUTE_PATHS.includes(route))
    .map(route => `${label} names "${route}", which is not in the route registry`);
}

/**
 * Returns a human-readable problem for every malformed exception. An empty
 * array means the allowlist is well-formed.
 *
 * The bounding rule matters as much as the mandatory fields: a wildcard scope
 * is only accepted on a `route` exception that names its routes, so a blanket
 * waiver can never silently cover a page nobody reviewed it against.
 */
export function findInvalidExceptions(exceptions: readonly A11yException[]): string[] {
  return exceptions.flatMap((exception, index) => {
    const label = `A11Y_EXCEPTIONS[${index}] (${exception.ruleId || 'no rule id'})`;
    const problems = [
      ...findExceptionProblems(exception, label),
      ...findRouteProblems(exception, label),
    ];

    if (exception.scope === EXCEPTION_SCOPE_ANY && exception.layer !== 'route') {
      problems.push(
        `${label} may only use the "${EXCEPTION_SCOPE_ANY}" scope on a route ` +
          'exception that names its routes'
      );
    }

    return problems;
  });
}

/**
 * Flattens an axe node target into its plain CSS selector segments. axe models
 * a target as a possibly nested array so it can address elements inside frames
 * and shadow roots; the nesting is irrelevant for scope matching.
 */
function flattenSelector(target: NodeResult['target']): string[] {
  const selectors: string[] = [];

  const walk: (value: unknown) => void = value => {
    if (typeof value === 'string') {
      selectors.push(value);
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
    }
  };

  walk(target);

  return selectors;
}

/** The selector chain of a failing node, as a single readable string. */
export function selectorTextOf(node: NodeResult): string {
  return flattenSelector(node.target).join(' ');
}

function matchesScope(selectorText: string, scope: string): boolean {
  if (scope === EXCEPTION_SCOPE_ANY) {
    return true;
  }

  return (
    selectorText === scope ||
    selectorText.startsWith(`${scope} `) ||
    selectorText.startsWith(`${scope}>`)
  );
}

/** A component-level scan; component exceptions apply, route ones never do. */
export interface ComponentScanContext {
  readonly layer: 'component';
}

/** A scan of one route; only exceptions naming that route apply. */
export interface RouteScanContext {
  readonly layer: 'route';
  readonly route: string;
}

/** Where a scan is running, so an exception only applies where it was reviewed. */
export type A11yScanContext = ComponentScanContext | RouteScanContext;

function appliesTo(exception: A11yException, context: A11yScanContext): boolean {
  if (exception.layer !== context.layer) {
    return false;
  }

  return context.layer === 'component' || (exception.routes ?? []).includes(context.route);
}

/**
 * Drops the nodes covered by an accepted exception and returns whatever still
 * violates the standard.
 *
 * Filtering is per node, never per rule: an exception scoped to one selector
 * can never hide the same rule failing at a different selector, so a new
 * regression still fails the gate.
 */
export function filterAllowedViolations(
  violations: readonly Result[],
  context: A11yScanContext,
  exceptions: readonly A11yException[] = A11Y_EXCEPTIONS
): Result[] {
  const active = exceptions.filter(exception => appliesTo(exception, context));

  return violations.flatMap(violation => {
    const applicable = active.filter(exception => exception.ruleId === violation.id);

    if (applicable.length === 0) {
      return [violation];
    }

    const remainingNodes = violation.nodes.filter(node => {
      const selectorText = selectorTextOf(node);
      return !applicable.some(exception => matchesScope(selectorText, exception.scope));
    });

    return remainingNodes.length === 0 ? [] : [{ ...violation, nodes: remainingNodes }];
  });
}

/** Formats violations into a failure message naming the rule and every node. */
export function describeViolations(violations: readonly Result[]): string {
  if (violations.length === 0) {
    return 'No accessibility violations.';
  }

  const details = violations.map(violation => {
    const targets = violation.nodes.map(node => `      - ${selectorTextOf(node)}`).join('\n');
    return [
      `  ${violation.id} (${violation.impact ?? 'unknown'} impact): ${violation.help}`,
      `    ${violation.helpUrl}`,
      targets,
    ].join('\n');
  });

  const heading: string = `${violations.length} accessibility violation(s) against WCAG 2.1 AA:`;

  return `${heading}\n${details.join('\n')}`;
}
