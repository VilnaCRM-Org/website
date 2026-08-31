import axe from 'axe-core';
import type { NodeResult, Result } from 'axe-core';

import {
  A11Y_EXCEPTIONS,
  EXCEPTION_SCOPE_ANY,
  FORCED_RULES,
  JSDOM_UNSUPPORTED_RULES,
  WCAG_AA_TAGS,
  describeViolations,
  filterAllowedViolations,
  findInvalidExceptions,
  selectorTextOf,
  type A11yException,
} from '../../a11y/axe-config';
import { A11Y_ROUTES } from '../../a11y/routes';

const TRACKING_URL: string = 'https://github.com/VilnaCRM-Org/website/issues/423';

/**
 * A selector for one failing node: a plain CSS selector, or the chain axe emits
 * when the element lives inside a frame or shadow root.
 */
type ProbeTarget = string | readonly string[];

function toAxeTarget(target: ProbeTarget): NodeResult['target'] {
  const value: unknown = typeof target === 'string' ? [target] : [[...target]];

  return value as NodeResult['target'];
}

function makeNodeFrom(target: NodeResult['target']): NodeResult {
  return {
    target,
    html: '<span></span>',
    any: [],
    all: [],
    none: [],
  } as unknown as NodeResult;
}

function makeNode(target: ProbeTarget): NodeResult {
  return makeNodeFrom(toAxeTarget(target));
}

function makeViolation(id: string, targets: readonly ProbeTarget[]): Result {
  return {
    id,
    impact: 'serious',
    help: `${id} help`,
    helpUrl: `https://dequeuniversity.com/rules/axe/4.12/${id}`,
    description: `${id} description`,
    tags: ['wcag2aa'],
    nodes: targets.map(makeNode),
  } as unknown as Result;
}

/** A route exception; `routes` is always present, as the type requires. */
function makeException(overrides: Partial<A11yException> = {}): A11yException {
  return {
    ruleId: 'color-contrast',
    scope: '.brand',
    layer: 'route',
    routes: ['/'],
    reason: 'accepted debt',
    trackingUrl: TRACKING_URL,
    ...overrides,
  };
}

/**
 * A component exception. `routes` is omitted entirely rather than set to
 * `undefined`, which `exactOptionalPropertyTypes` rejects and which is also the
 * shape a real entry has.
 */
function makeComponentException(
  overrides: Partial<Omit<A11yException, 'layer' | 'routes'>> = {}
): A11yException {
  return {
    ruleId: 'color-contrast',
    scope: '.brand',
    layer: 'component',
    reason: 'accepted debt',
    trackingUrl: TRACKING_URL,
    ...overrides,
  };
}

describe('accessibility acceptance standard', () => {
  describe('rule set', () => {
    it('gates exactly the WCAG 2.1 AA tag set', () => {
      expect([...WCAG_AA_TAGS]).toEqual(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']);
    });

    it('does not gate on advisory or higher-level tags', () => {
      const tags: readonly string[] = WCAG_AA_TAGS;

      expect(tags).not.toContain('best-practice');
      expect(tags).not.toContain('wcag2aaa');
      expect(tags).not.toContain('wcag22aa');
    });

    it('force-enables only WCAG-tagged rules that axe suppresses by default', () => {
      const gated: string[] = axe.getRules([...WCAG_AA_TAGS]).map(rule => rule.ruleId);

      Object.keys(FORCED_RULES).forEach(ruleId => {
        // Carries a WCAG 2.1 AA tag, so it belongs in the standard...
        expect(gated).toContain(ruleId);

        // ...but axe's default `tagExclude` drops it, which is why the override
        // exists. If a release un-flags one of these, drop it from the list.
        const rule = axe.getRules().find(candidate => candidate.ruleId === ruleId);
        expect(rule?.tags).toEqual(
          expect.arrayContaining([expect.stringMatching(/^(experimental|deprecated)$/)])
        );
      });
    });

    it('keeps the only wcag21a rule inside the gate', () => {
      const wcag21aRules: string[] = axe
        .getRules(['wcag21a'])
        .map(rule => rule.ruleId)
        .sort();

      // If this ever grows, the `wcag21a` tag starts pulling its own weight and
      // the override below may no longer be the only thing keeping it alive.
      expect(wcag21aRules).toEqual(['label-content-name-mismatch']);
      expect(Object.keys(FORCED_RULES)).toContain('label-content-name-mismatch');
    });

    it('disables exactly the colour rules jsdom cannot evaluate', () => {
      const gatedColourRules: string[] = axe
        .getRules(['cat.color'])
        .map(rule => rule.ruleId)
        .filter(ruleId => axe.getRules([...WCAG_AA_TAGS]).some(rule => rule.ruleId === ruleId))
        .sort();

      expect(Object.keys(JSDOM_UNSUPPORTED_RULES).sort()).toEqual(gatedColourRules);
      Object.values(JSDOM_UNSUPPORTED_RULES).forEach(rule => expect(rule.enabled).toBe(false));
    });
  });

  describe('the committed allowlist', () => {
    it('is well-formed', () => {
      expect(findInvalidExceptions(A11Y_EXCEPTIONS)).toEqual([]);
    });

    it('waives only rules axe actually ships', () => {
      const knownRules: string[] = axe.getRules().map(rule => rule.ruleId);

      A11Y_EXCEPTIONS.forEach(exception => expect(knownRules).toContain(exception.ruleId));
    });
  });

  describe('findInvalidExceptions', () => {
    it('accepts a fully specified exception', () => {
      expect(findInvalidExceptions([makeException()])).toEqual([]);
    });

    it.each([
      ['rule id', { ruleId: '  ' }, /missing an axe rule id/],
      ['scope', { scope: '' }, /missing a scope/],
      ['reason', { reason: ' ' }, /missing a reason/],
      ['tracking issue', { trackingUrl: 'https://example.com/issues/1' }, /tracking issue/],
    ])('reports a missing %s', (_label, overrides, expected) => {
      const problems: string[] = findInvalidExceptions([makeException(overrides)]);

      expect(problems).toHaveLength(1);
      expect(problems[0]).toMatch(expected);
    });

    it('rejects a tracking link that is not a repository issue', () => {
      const problems: string[] = findInvalidExceptions([
        makeException({ trackingUrl: 'https://github.com/VilnaCRM-Org/website/pull/9' }),
      ]);

      expect(problems).toHaveLength(1);
    });

    it('rejects a route exception that names no routes', () => {
      const problems: string[] = findInvalidExceptions([makeException({ routes: [] })]);

      expect(problems).toEqual([expect.stringMatching(/must list the route paths/)]);
    });

    it('rejects a route exception naming an unregistered route', () => {
      const problems: string[] = findInvalidExceptions([makeException({ routes: ['/nope'] })]);

      expect(problems).toEqual([expect.stringMatching(/not in the route registry/)]);
    });

    it('rejects a component exception that lists routes', () => {
      const problems: string[] = findInvalidExceptions([
        makeException({ layer: 'component', routes: ['/'] }),
      ]);

      expect(problems).toEqual([expect.stringMatching(/must not list routes/)]);
    });

    it('accepts a component exception with no routes', () => {
      expect(findInvalidExceptions([makeComponentException()])).toEqual([]);
    });

    it('refuses an unbounded wildcard on a component exception', () => {
      const problems: string[] = findInvalidExceptions([
        makeComponentException({ scope: EXCEPTION_SCOPE_ANY }),
      ]);

      expect(problems).toEqual([expect.stringMatching(/may only use the "\*" scope/)]);
    });

    it('accepts a wildcard bounded to named routes', () => {
      expect(findInvalidExceptions([makeException({ scope: EXCEPTION_SCOPE_ANY })])).toEqual([]);
    });

    it('reports every problem of every entry', () => {
      const problems: string[] = findInvalidExceptions([
        makeException({ ruleId: '', reason: '' }),
        makeException(),
      ]);

      expect(problems).toHaveLength(2);
    });
  });

  describe('selectorTextOf', () => {
    it('joins a flat target', () => {
      expect(selectorTextOf(makeNode('.brand > span'))).toBe('.brand > span');
    });

    it('flattens a nested frame target', () => {
      expect(selectorTextOf(makeNode(['iframe#doc', '.brand']))).toBe('iframe#doc .brand');
    });

    it('ignores non-string target parts', () => {
      const shadowTarget: unknown = [{ fromShadowDom: true }];

      expect(selectorTextOf(makeNodeFrom(shadowTarget as NodeResult['target']))).toBe('');
    });
  });

  describe('filterAllowedViolations', () => {
    const violation: Result = makeViolation('color-contrast', ['.brand', '.other']);

    it('returns every violation when the allowlist is empty', () => {
      expect(filterAllowedViolations([violation], { layer: 'route', route: '/' }, [])).toEqual([
        violation,
      ]);
    });

    it('drops only the nodes covered by the scope', () => {
      const [remaining] = filterAllowedViolations([violation], { layer: 'route', route: '/' }, [
        makeException(),
      ]);

      expect(remaining?.nodes).toHaveLength(1);
      expect(selectorTextOf(remaining!.nodes[0]!)).toBe('.other');
    });

    it('drops the violation entirely when every node is covered', () => {
      expect(
        filterAllowedViolations([violation], { layer: 'route', route: '/' }, [
          makeException({ scope: EXCEPTION_SCOPE_ANY }),
        ])
      ).toEqual([]);
    });

    it('matches a scope at a descendant boundary but not a partial class name', () => {
      const nodes: Result = makeViolation('color-contrast', ['.brand-new', '.brand .child']);

      const [remaining] = filterAllowedViolations([nodes], { layer: 'route', route: '/' }, [
        makeException(),
      ]);

      expect(remaining?.nodes).toHaveLength(1);
      expect(selectorTextOf(remaining!.nodes[0]!)).toBe('.brand-new');
    });

    it('matches a scope followed by a child combinator', () => {
      const nodes: Result = makeViolation('color-contrast', ['.brand>span']);

      expect(
        filterAllowedViolations([nodes], { layer: 'route', route: '/' }, [makeException()])
      ).toEqual([]);
    });

    it('ignores an exception for a different rule', () => {
      expect(
        filterAllowedViolations([violation], { layer: 'route', route: '/' }, [
          makeException({ ruleId: 'select-name', scope: EXCEPTION_SCOPE_ANY }),
        ])
      ).toEqual([violation]);
    });

    it('ignores a route exception on a route it does not name', () => {
      expect(
        filterAllowedViolations([violation], { layer: 'route', route: '/swagger' }, [
          makeException({ scope: EXCEPTION_SCOPE_ANY }),
        ])
      ).toEqual([violation]);
    });

    it('ignores a route exception at the component layer', () => {
      expect(
        filterAllowedViolations([violation], { layer: 'component' }, [
          makeException({ scope: EXCEPTION_SCOPE_ANY }),
        ])
      ).toEqual([violation]);
    });

    it('applies a component exception at the component layer', () => {
      expect(
        filterAllowedViolations([violation], { layer: 'component' }, [
          makeComponentException({ scope: EXCEPTION_SCOPE_ANY }),
        ])
      ).toEqual([]);
    });

    it('defaults to the committed allowlist', () => {
      const contrast: Result = makeViolation('color-contrast', ['.anything']);

      expect(filterAllowedViolations([contrast], { layer: 'route', route: '/' })).toEqual([]);
      expect(filterAllowedViolations([contrast], { layer: 'component' })).toEqual([contrast]);
    });

    it('keeps the swagger select waiver off every other selector', () => {
      const selectName: Result = makeViolation('select-name', ['#servers', '#other-select']);

      const [remaining] = filterAllowedViolations([selectName], {
        layer: 'route',
        route: '/swagger',
      });

      expect(remaining?.nodes).toHaveLength(1);
      expect(selectorTextOf(remaining!.nodes[0]!)).toBe('#other-select');
    });
  });

  describe('describeViolations', () => {
    it('reports a clean result', () => {
      expect(describeViolations([])).toBe('No accessibility violations.');
    });

    it('names the rule, impact, help URL and every failing selector', () => {
      const message: string = describeViolations([
        makeViolation('color-contrast', ['.brand', '.other']),
      ]);

      expect(message).toContain('1 accessibility violation(s) against WCAG 2.1 AA');
      expect(message).toContain('color-contrast (serious impact)');
      expect(message).toContain('https://dequeuniversity.com/rules/axe/4.12/color-contrast');
      expect(message).toContain('- .brand');
      expect(message).toContain('- .other');
    });

    it('falls back to an unknown impact', () => {
      // Omit the key entirely rather than setting it to `undefined`: axe types
      // `impact` as optional, and `exactOptionalPropertyTypes` rejects the latter.
      const { impact, ...withoutImpact } = makeViolation('region', ['.x']);
      expect(impact).toBe('serious');

      expect(describeViolations([withoutImpact as Result])).toContain('(unknown impact)');
    });
  });

  describe('route registry coupling', () => {
    it('validates exception routes against the registry', () => {
      A11Y_EXCEPTIONS.filter(exception => exception.layer === 'route').forEach(exception => {
        (exception.routes ?? []).forEach(route => {
          expect(A11Y_ROUTES.map(entry => entry.path)).toContain(route);
        });
      });
    });
  });
});
