// Declaration shim for the sibling gate module `leakGate.js`. The memlab runner is plain
// ESM JavaScript executed by node inside the memory-leak container, so the module stays
// `.js`; this exposes its surface to src/test/unit/memlab-leak-gate.test.ts under
// `allowJs: false`.

/** One accepted-debt entry in `leak-baseline.json`. */
export interface LeakAllowance {
  allowedClusters: number;
  reason: string;
  issue: string;
  validUntil: string;
}

/** The parsed `leak-baseline.json` document. */
export interface LeakBaseline {
  scenarios?: Record<string, unknown>;
}

/** The kinds of finding the gate can report. */
export type LeakFindingKind =
  | 'new-leak'
  | 'regression'
  | 'expired'
  | 'malformed-entry'
  | 'stale-entry'
  | 'ratchet'
  | 'allowed';

/** A single failure or notice produced by the gate. */
export interface LeakFinding {
  kind: LeakFindingKind;
  scenario: string;
  observed: number;
  allowed: number;
  message: string;
}

/** The verdict for one memlab run. */
export interface LeakVerdict {
  ok: boolean;
  failures: LeakFinding[];
  notices: LeakFinding[];
  totalClusters: number;
}

export declare const TRACE_CHAR_LIMIT: number;

export declare function summarizeTrace(trace: unknown, limit: number): string;

export declare function describeAllowanceProblem(allowance: unknown): string | null;

export declare function isExpired(validUntil: string, today: string): boolean;

export declare function evaluateLeakRun(
  observed: Record<string, number>,
  baseline: LeakBaseline,
  today: string
): LeakVerdict;

export declare function formatVerdict(verdict: LeakVerdict): string[];
