# Project Configuration

The rust-code-analysis metrics gate described here is introduced by the complexity/metrics
work (issue #224); the commands and files it names land with that work and are not yet on
`main`.

## Metrics Scope

`make lint-metrics` analyzes the `src/` tree and includes only `*.ts` and `*.tsx`
sources. It excludes test files (`*/test/*`), type declarations (`*.d.ts`),
`assets`, and `config`. The target is host-only: it auto-installs the pinned
rust-code-analysis CLI to `./bin` (gitignored) on first run and is intentionally
not part of `make lint` or the CI lint aggregate.

## Related Files

These files ship with issue #224 and are not yet on `main`:

- `config/metrics-policy.json`: the hard and review thresholds (source of truth,
  ships with #224).
- `config/metrics-policy.schema.json`: draft-07 schema the policy is validated
  against before enforcement (ships with #224).
- `scripts/ci/lint-metrics.sh`: parses the analyzer output against the policy and
  owns the pass/fail contract (collect all violations, then fail; ships with #224).
- `scripts/ci/ensure-rca.sh`: provisions and SHA256-verifies the pinned CLI
  (ships with #224).
- `.github/workflows/rust-code-analysis.yml`: the CI gate that runs the same
  policy on pull requests to main (ships with #224).
- README "Code Metrics (rust-code-analysis)" section: the human-readable summary
  (ships with #224).

## Update Rule

Threshold changes are a reviewed, deliberate act — never a way to unblock a
branch. If the policy genuinely must change, update `config/metrics-policy.json`,
keep it valid against `config/metrics-policy.schema.json`, and update the README
"Code Metrics" section in the same change so the docs and gate stay in sync.
