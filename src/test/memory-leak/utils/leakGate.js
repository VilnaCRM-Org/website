/**
 * Verdict logic for the memlab leak gate (issue #354).
 *
 * `runMemlabTests.js` used to discard the `leaks` array that `@memlab/api`'s `run()`
 * returns, so a run that detected fifty leak clusters exited 0 exactly like a clean one.
 * This module turns the per-scenario cluster counts into a pass/fail verdict against
 * `leak-baseline.json`, which records the clusters that already existed when the gate was
 * armed. Each baseline entry must carry a reason, a tracking issue, and an expiry date, so
 * accepted debt stays visible and time-boxed rather than becoming silently permanent.
 *
 * The findings, in order of severity:
 *
 * - `new-leak` — clusters in a scenario with no baseline entry, i.e. a leak this change added
 * - `regression` — more clusters than the recorded allowance
 * - `expired` — a leaking scenario whose allowance is past its `validUntil` date
 * - `malformed-entry` — an allowance missing a reason, an issue, or a usable expiry
 * - `stale-entry` — an allowance for a scenario that no longer runs
 *
 * Counts below the allowance are reported as `ratchet` notices rather than failures: memlab
 * cluster counts vary slightly between runs, so demanding an exact match would make the gate
 * flaky. Lower the allowance once a notice is reported consistently.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Characters of serialized retainer trace printed per cluster. memlab already prints the
 * readable trace and the retained-size summary in VERBOSE mode, so this inline copy only
 * has to identify the cluster — dumping all of it would add megabytes to every red run.
 */
export const TRACE_CHAR_LIMIT = 1200;

/**
 * Clusters printed per failing scenario. Bounds the total output on a scenario with a large
 * allowance, where most clusters are already-accepted debt rather than the regression.
 */
export const TRACE_COUNT_LIMIT = 5;

/**
 * Serialize one retainer trace, truncated to `limit` characters.
 *
 * @param {unknown} trace One entry of the `leaks` array `@memlab/api`'s `run()` returns.
 * @param {number} limit
 * @returns {string}
 */
export function summarizeTrace(trace, limit) {
  const serialized = JSON.stringify(trace);
  if (serialized.length <= limit) {
    return serialized;
  }
  const dropped = serialized.length - limit;
  const hint = 'full trace in the scenario work dir';
  return `${serialized.slice(0, limit)}… (+${dropped} chars; ${hint})`;
}

/**
 * Build one finding record.
 *
 * @param {{ kind: string, scenario: string, observed?: number, allowed?: number,
 *   message: string }} finding
 */
function finding({ kind, scenario, observed = 0, allowed = 0, message }) {
  return { kind, scenario, observed, allowed, message };
}

/**
 * Why a baseline entry cannot be used, or `null` when it is well-formed.
 *
 * An allowance with no reason, no tracking issue, or no readable deadline is indefinite,
 * unattributed debt — exactly what this gate exists to prevent — so it fails the run rather
 * than quietly defaulting.
 *
 * @param {unknown} allowance
 * @returns {string | null}
 */
export function describeAllowanceProblem(allowance) {
  if (typeof allowance !== 'object' || allowance === null) {
    return 'the entry must be an object';
  }
  const { allowedClusters, reason, issue, validUntil } = allowance;
  if (!Number.isInteger(allowedClusters) || allowedClusters < 1) {
    return 'allowedClusters must be a positive integer';
  }
  if (typeof reason !== 'string' || reason.trim() === '') {
    return 'reason must say why the clusters are accepted';
  }
  if (typeof issue !== 'string' || issue.trim() === '') {
    return 'issue must link the burn-down ticket';
  }
  if (typeof validUntil !== 'string' || !ISO_DATE.test(validUntil)) {
    return 'validUntil must be a YYYY-MM-DD date';
  }
  return null;
}

/**
 * Whether an allowance's expiry date has passed. Dates are ISO-8601, so a lexicographic
 * comparison is a chronological one.
 *
 * @param {string} validUntil
 * @param {string} today
 * @returns {boolean}
 */
export function isExpired(validUntil, today) {
  return validUntil < today;
}

/**
 * Audit the baseline itself: every entry must be well-formed and must still name a scenario
 * that runs.
 *
 * @param {Record<string, unknown>} allowances
 * @param {Record<string, number>} observed
 * @returns {{ failures: object[], usable: Map<string, object>, malformed: Set<string> }}
 */
function auditBaseline(allowances, observed) {
  const failures = [];
  const usable = new Map();
  const malformed = new Set();

  for (const [scenario, allowance] of Object.entries(allowances)) {
    const problem = describeAllowanceProblem(allowance);
    if (problem !== null) {
      malformed.add(scenario);
      failures.push(
        finding({
          kind: 'malformed-entry',
          scenario,
          message: `leak-baseline.json entry "${scenario}" is unusable: ${problem}.`,
        })
      );
    } else if (Object.hasOwn(observed, scenario)) {
      usable.set(scenario, allowance);
    } else {
      failures.push(
        finding({
          kind: 'stale-entry',
          scenario,
          allowed: allowance.allowedClusters,
          message:
            `leak-baseline.json allows leaks for "${scenario}", which is not one of the ` +
            'scenarios that ran. Remove the entry or fix the scenario name.',
        })
      );
    }
  }

  return { failures, usable, malformed };
}

/**
 * Classify one scenario's cluster count against its allowance.
 *
 * @param {{ scenario: string, count: number, allowance: object | undefined, today: string }} input
 * @returns {object}
 */
function classifyScenario({ scenario, count, allowance, today }) {
  if (allowance === undefined) {
    return finding({
      kind: 'new-leak',
      scenario,
      observed: count,
      message:
        `${scenario} detected ${count} leak cluster(s) and has no baseline entry. ` +
        'Fix the leak; do not add an allowance for a leak this change introduced.',
    });
  }

  const allowed = allowance.allowedClusters;

  if (count > allowed) {
    return finding({
      kind: 'regression',
      scenario,
      observed: count,
      allowed,
      message:
        `${scenario} detected ${count} leak cluster(s), above its baseline allowance of ` +
        `${allowed}. Fix the new retainers; never raise the allowance to absorb them.`,
    });
  }

  if (isExpired(allowance.validUntil, today)) {
    return finding({
      kind: 'expired',
      scenario,
      observed: count,
      allowed,
      message:
        `${scenario}'s baseline allowance expired on ${allowance.validUntil}. ` +
        `Burn the clusters down or re-triage them in ${allowance.issue}.`,
    });
  }

  if (count < allowed) {
    return finding({
      kind: 'ratchet',
      scenario,
      observed: count,
      allowed,
      message:
        `${scenario} detected ${count} of ${allowed} allowed cluster(s); ` +
        `lower the allowance to ${count} once that count is reproducible.`,
    });
  }

  return finding({
    kind: 'allowed',
    scenario,
    observed: count,
    allowed,
    message:
      `${scenario} detected ${count} allowed cluster(s) ` +
      `(${allowance.issue}, expires ${allowance.validUntil}).`,
  });
}

/** Findings that describe accepted state rather than a failure. */
const NOTICE_KINDS = new Set(['allowed', 'ratchet']);

/**
 * Grade one scenario's result, or `null` when it needs no finding.
 *
 * A scenario whose baseline entry is malformed is already reported by `auditBaseline`, so
 * it is skipped here rather than reported twice.
 *
 * @param {{ scenario: string, count: number, usable: Map<string, object>,
 *   malformed: Set<string>, today: string }} input
 * @returns {object | null}
 */
function gradeScenario({ scenario, count, usable, malformed, today }) {
  if (malformed.has(scenario)) {
    return null;
  }

  const allowance = usable.get(scenario);

  if (count === 0) {
    if (allowance === undefined) {
      return null;
    }
    return finding({
      kind: 'ratchet',
      scenario,
      allowed: allowance.allowedClusters,
      message:
        `${scenario} reported no leak clusters but still holds a baseline allowance. ` +
        'If it reports zero consistently, remove its entry from leak-baseline.json to lock ' +
        'the fix in — but confirm across runs first, because a single zero can be run-to-run ' +
        'variance and removing a still-valid entry turns the next run into a blocking ' +
        'new-leak failure.',
    });
  }

  return classifyScenario({ scenario, count, allowance, today });
}

/**
 * Compare one run's per-scenario cluster counts against the baseline.
 *
 * @param {Record<string, number>} observed Cluster count per scenario name, for every
 *   scenario that ran (including the ones that leaked nothing).
 * @param {{ scenarios?: Record<string, unknown> }} baseline Parsed `leak-baseline.json`.
 * @param {string} today Current date as `YYYY-MM-DD`. Injected rather than read from the
 *   clock so the verdict is testable.
 */
export function evaluateLeakRun(observed, baseline, today) {
  const allowances = baseline.scenarios ?? {};
  const { failures, usable, malformed } = auditBaseline(allowances, observed);
  const notices = [];
  let totalClusters = 0;

  for (const [scenario, count] of Object.entries(observed)) {
    totalClusters += count;
    const outcome = gradeScenario({ scenario, count, usable, malformed, today });
    if (outcome !== null) {
      (NOTICE_KINDS.has(outcome.kind) ? notices : failures).push(outcome);
    }
  }

  return { ok: failures.length === 0, failures, notices, totalClusters };
}

/**
 * Render the verdict as the lines the runner writes to stderr.
 *
 * @param {{ ok: boolean, failures: object[], notices: object[], totalClusters: number }} verdict
 * @returns {string[]}
 */
export function formatVerdict(verdict) {
  const lines = [];
  for (const notice of verdict.notices) {
    lines.push(`[memlab] note: ${notice.message}`);
  }
  for (const failure of verdict.failures) {
    lines.push(`[memlab] ${failure.kind}: ${failure.message}`);
  }
  lines.push(
    verdict.ok
      ? `[memlab] PASS: ${verdict.totalClusters} leak cluster(s), all within leak-baseline.json`
      : `[memlab] FAIL: ${verdict.failures.length} unaccounted leak finding(s); ` +
          'see the traces above'
  );
  return lines;
}
