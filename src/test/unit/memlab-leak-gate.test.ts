import {
  describeAllowanceProblem,
  evaluateLeakRun,
  formatVerdict,
  isExpired,
  summarizeTrace,
  TRACE_CHAR_LIMIT,
  type LeakAllowance,
  type LeakBaseline,
} from '../memory-leak/utils/leakGate';

const TODAY = '2026-08-10';

const VALID_ALLOWANCE: LeakAllowance = {
  allowedClusters: 2,
  reason: 'pre-existing when the gate was armed',
  issue: 'https://github.com/VilnaCRM-Org/website/issues/354',
  validUntil: '2027-02-10',
};

/** A baseline holding one allowance for `scenario`, with optional field overrides. */
function baseline(scenario: string, overrides: Partial<LeakAllowance> = {}): LeakBaseline {
  return { scenarios: { [scenario]: { ...VALID_ALLOWANCE, ...overrides } } };
}

describe('memlab leak gate', () => {
  describe('describeAllowanceProblem', () => {
    it('accepts a fully specified allowance', () => {
      expect(describeAllowanceProblem(VALID_ALLOWANCE)).toBeNull();
    });

    it.each([null, 'two', 42])('rejects the non-object entry %p', value => {
      expect(describeAllowanceProblem(value)).toBe('the entry must be an object');
    });

    it.each([0, -1, 1.5, '2', undefined])('rejects allowedClusters %p', value => {
      expect(describeAllowanceProblem({ ...VALID_ALLOWANCE, allowedClusters: value })).toBe(
        'allowedClusters must be a positive integer'
      );
    });

    it.each(['', '   ', undefined])('rejects the reason %p', value => {
      expect(describeAllowanceProblem({ ...VALID_ALLOWANCE, reason: value })).toBe(
        'reason must say why the clusters are accepted'
      );
    });

    it.each(['', undefined])('rejects the issue link %p', value => {
      expect(describeAllowanceProblem({ ...VALID_ALLOWANCE, issue: value })).toBe(
        'issue must link the burn-down ticket'
      );
    });

    it.each(['', 'soon', '10-08-2026', undefined])('rejects the expiry %p', value => {
      expect(describeAllowanceProblem({ ...VALID_ALLOWANCE, validUntil: value })).toBe(
        'validUntil must be a YYYY-MM-DD date'
      );
    });
  });

  describe('summarizeTrace', () => {
    it('serializes a short trace unchanged', () => {
      expect(summarizeTrace({ node: 'Detached HTMLDivElement' }, TRACE_CHAR_LIMIT)).toBe(
        '{"node":"Detached HTMLDivElement"}'
      );
    });

    it('truncates a trace past the limit and says how much was dropped', () => {
      const trace = { node: 'x'.repeat(50) };
      const dropped = JSON.stringify(trace).length - 20;

      const summary = summarizeTrace(trace, 20);

      expect(summary.slice(0, 20)).toBe(JSON.stringify(trace).slice(0, 20));
      expect(summary).toContain(`… (+${dropped} chars; full trace in the scenario work dir)`);
    });

    it('keeps a trace exactly on the limit intact', () => {
      const serialized = JSON.stringify({ a: 1 });

      expect(summarizeTrace({ a: 1 }, serialized.length)).toBe(serialized);
    });

    it('caps CI output well below a raw dump', () => {
      expect(TRACE_CHAR_LIMIT).toBeLessThanOrEqual(2000);
    });
  });

  describe('isExpired', () => {
    it('accepts a deadline in the future', () => {
      expect(isExpired('2027-02-10', TODAY)).toBe(false);
    });

    it('accepts the deadline day itself and expires the day after', () => {
      expect(isExpired('2026-08-10', TODAY)).toBe(false);
      expect(isExpired('2026-08-09', TODAY)).toBe(true);
    });
  });

  describe('evaluateLeakRun', () => {
    it('passes a run with no leak clusters and no allowances', () => {
      const verdict = evaluateLeakRun({ logoNavigation: 0 }, { scenarios: {} }, TODAY);

      expect(verdict.ok).toBe(true);
      expect(verdict.failures).toEqual([]);
      expect(verdict.notices).toEqual([]);
      expect(verdict.totalClusters).toBe(0);
    });

    it('fails a scenario that leaks with no baseline entry', () => {
      const verdict = evaluateLeakRun({ fillForm: 3 }, { scenarios: {} }, TODAY);

      expect(verdict.ok).toBe(false);
      expect(verdict.failures).toHaveLength(1);
      expect(verdict.failures[0]).toMatchObject({
        kind: 'new-leak',
        scenario: 'fillForm',
        observed: 3,
      });
    });

    it('fails a scenario that leaks more than its allowance', () => {
      const verdict = evaluateLeakRun({ fillForm: 3 }, baseline('fillForm'), TODAY);

      expect(verdict.ok).toBe(false);
      expect(verdict.failures[0]).toMatchObject({ kind: 'regression', observed: 3, allowed: 2 });
    });

    it('passes a scenario sitting exactly on its allowance', () => {
      const verdict = evaluateLeakRun({ fillForm: 2 }, baseline('fillForm'), TODAY);

      expect(verdict.ok).toBe(true);
      expect(verdict.notices[0]).toMatchObject({ kind: 'allowed', observed: 2 });
      expect(verdict.notices[0]?.message).toContain('expires 2027-02-10');
    });

    it('passes but asks for a ratchet when a scenario leaks less than allowed', () => {
      const verdict = evaluateLeakRun({ fillForm: 1 }, baseline('fillForm'), TODAY);

      expect(verdict.ok).toBe(true);
      expect(verdict.notices[0]).toMatchObject({ kind: 'ratchet', observed: 1, allowed: 2 });
      expect(verdict.notices[0]?.message).toContain('lower the allowance to 1');
    });

    it('fails once a leaking scenario passes its expiry date', () => {
      const verdict = evaluateLeakRun(
        { fillForm: 2 },
        baseline('fillForm', { validUntil: '2026-01-01' }),
        TODAY
      );

      expect(verdict.ok).toBe(false);
      expect(verdict.failures[0]).toMatchObject({ kind: 'expired' });
    });

    it('reports a regression ahead of an expiry on the same scenario', () => {
      const verdict = evaluateLeakRun(
        { fillForm: 5 },
        baseline('fillForm', { allowedClusters: 1, validUntil: '2026-01-01' }),
        TODAY
      );

      expect(verdict.failures).toHaveLength(1);
      expect(verdict.failures[0]?.kind).toBe('regression');
    });

    it('fails on a baseline entry for a scenario that did not run', () => {
      const verdict = evaluateLeakRun({ logoNavigation: 0 }, baseline('deletedScenario'), TODAY);

      expect(verdict.ok).toBe(false);
      expect(verdict.failures[0]).toMatchObject({
        kind: 'stale-entry',
        scenario: 'deletedScenario',
        allowed: 2,
      });
    });

    it('fails on an allowance with no tracking issue instead of defaulting', () => {
      const verdict = evaluateLeakRun({ fillForm: 2 }, baseline('fillForm', { issue: '' }), TODAY);

      expect(verdict.ok).toBe(false);
      expect(verdict.failures).toHaveLength(1);
      expect(verdict.failures[0]).toMatchObject({ kind: 'malformed-entry' });
      expect(verdict.failures[0]?.message).toContain('issue must link the burn-down ticket');
    });

    it('does not also report a new-leak for a scenario whose entry is malformed', () => {
      const verdict = evaluateLeakRun(
        { fillForm: 9 },
        baseline('fillForm', { validUntil: 'whenever' }),
        TODAY
      );

      expect(verdict.failures.map(failure => failure.kind)).toEqual(['malformed-entry']);
      expect(verdict.totalClusters).toBe(9);
    });

    it('asks for removal when an allowed scenario stops leaking', () => {
      const verdict = evaluateLeakRun({ fillForm: 0 }, baseline('fillForm'), TODAY);

      expect(verdict.ok).toBe(true);
      expect(verdict.notices[0]).toMatchObject({ kind: 'ratchet', observed: 0, allowed: 2 });
      expect(verdict.notices[0]?.message).toContain('Remove its entry');
    });

    it('sums clusters across every scenario', () => {
      const verdict = evaluateLeakRun(
        { fillForm: 2, logoNavigation: 0, swaggerInteractions: 4 },
        { scenarios: {} },
        TODAY
      );

      expect(verdict.totalClusters).toBe(6);
      expect(verdict.failures).toHaveLength(2);
    });

    it('treats a baseline with no scenarios map as allowing nothing', () => {
      const verdict = evaluateLeakRun({ fillForm: 1 }, {}, TODAY);

      expect(verdict.ok).toBe(false);
      expect(verdict.failures[0]?.kind).toBe('new-leak');
    });

    it('does not mistake an inherited property name for an allowance', () => {
      const verdict = evaluateLeakRun({ constructor: 1 }, { scenarios: {} }, TODAY);

      expect(verdict.failures[0]).toMatchObject({ kind: 'new-leak', scenario: 'constructor' });
    });
  });

  describe('formatVerdict', () => {
    it('ends a clean run with a PASS line carrying the cluster total', () => {
      const lines = formatVerdict(evaluateLeakRun({ fillForm: 2 }, baseline('fillForm'), TODAY));

      expect(lines[lines.length - 1]).toBe(
        '[memlab] PASS: 2 leak cluster(s), all within leak-baseline.json'
      );
      expect(lines[0]).toBe(
        '[memlab] note: fillForm detected 2 allowed cluster(s) ' +
          '(https://github.com/VilnaCRM-Org/website/issues/354, expires 2027-02-10).'
      );
    });

    it('ends a red run with a FAIL line and prefixes each failure with its kind', () => {
      const lines = formatVerdict(evaluateLeakRun({ fillForm: 9 }, { scenarios: {} }, TODAY));

      expect(lines.some(line => line.startsWith('[memlab] new-leak:'))).toBe(true);
      expect(lines[lines.length - 1]).toContain('FAIL: 1 unaccounted leak finding(s)');
    });
  });
});
