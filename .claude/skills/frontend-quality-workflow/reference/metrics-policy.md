# Metrics Policy

**Status:** introduced by issue #224 — not yet present on `main`. The gate, its
policy files, and the guidance below apply once #224 lands.

## Source Of Truth

`config/metrics-policy.json` defines the rust-code-analysis complexity budgets and is the
single source of truth — read it for the current numbers rather than memorizing them. It
is validated against `config/metrics-policy.schema.json`, mirrors the CRM sister repo's
strict budgets, and is applied identically by the local target `make lint-metrics` and the
CI workflow `.github/workflows/rust-code-analysis.yml`. This gate is delivered by issue
#224.

Do not lower a threshold, exclude a file, or suppress a metric to pass a feature branch.

## How It Runs

- Mozilla `rust-code-analysis-cli` only **emits** metrics. `scripts/ci/lint-metrics.sh`
  parses them against the policy and owns the non-zero exit on a hard breach
  (collect-all-then-fail). `scripts/ci/ensure-rca.sh` provisions the pinned, SHA-verified
  CLI into a gitignored `./bin`.
- Scope is `src/` TypeScript and TSX; tests, `*.d.ts`, assets, and config are excluded.
- The gate is **host-only** and is not part of `make lint` — run it explicitly.

## Two Tiers

- **Hard** metrics block (printed as `FAIL` rows) — treat a hard violation as work that is
  not done.
- **Review** metrics are computed but do not block — use them as a heads-up before a file
  drifts into a hard breach.

## Common Fixes

These reduce complexity without weakening the budgets. See the `complexity-management`
skill for worked, website-specific examples.

- Split large files by owner (for example a feature's `styles.ts` into
  `styles.layout.ts` / `styles.screens.ts` / `styles.shapes.ts`).
- Extract pure helpers from hooks and components.
- Deduplicate repeated style objects.
- Replace complex branches with a typed lookup map (`Record<...>`).
- Consolidate scattered early returns into guard clauses plus one resolved return.

Run:

```bash
make lint-metrics
```
