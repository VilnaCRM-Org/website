# ADR 0004: Gate code complexity with rust-code-analysis, and never lower a threshold

- **Status:** Accepted
- **Date:** 2026-09-09 (backfilled; delivered under issue #224)
- **Deciders:** website maintainers
- **Related:** issue #224, issue #341

## Context

Complexity is the decay this repository's other gates cannot see. Tests, types, lint, and
mutation testing all stay green while a component grows a tenth branch, a helper grows a
fourth parameter, and a file passes three hundred lines — and each of those makes the
next change more expensive and the next reviewer less able to say what the code does.
Review alone does not hold the line, because every individual increment is defensible.

The organisation's CRM sister repository already ran Mozilla's rust-code-analysis against
strict budgets, so the numbers had precedent rather than being invented here.

## Decision

We enforce a complexity budget mechanically.

- `config/metrics-policy.json` is the single source of thresholds, applied identically by
  the local `make lint-metrics` target and by
  [`rust-code-analysis.yml`](../../.github/workflows/rust-code-analysis.yml).
- Thresholds are split in two. **Hard** metrics block CI: cyclomatic, cognitive, ABC
  magnitude, argument and exit counts, function and file size, Halstead volume and bugs,
  the Maintainability Index, and the class/interface member budgets. **Review** metrics —
  the wider Halstead family, comment and blank ratios, the other MI variants — are
  computed and reported but never block.
- The gate runs on the host, because rust-code-analysis is a native binary the dev image
  does not ship. It therefore sits outside `make lint` (see ADR 0002).
- The response to a red gate is to reduce the complexity: extract a helper, replace a
  branch chain with a lookup map, collapse an argument list into a typed options object,
  split the file, consolidate exits. Lowering a threshold, excluding a file, or
  suppressing a metric is not an accepted response.

## Consequences

### What this buys

A ceiling that does not erode. Because the same policy file drives the local target and
CI, a contributor sees the failure before pushing, and because thresholds may only move
in the stricter direction the budget cannot be quietly renegotiated one PR at a time. The
refactoring moves it forces are the ones that make code testable, which is why the gate
also helps the mutation and coverage numbers.

### What this costs

- **False pressure on genuinely irreducible code.** Some functions are one honest switch
  over a wide enumeration; the gate counts branches, not intent, and the only remedy on
  offer is a lookup table that may read worse than the switch it replaced.
- **Fragmentation risk.** "Extract a helper" applied under threshold pressure can turn
  one readable 45-line function into four helpers whose relationship exists only in the
  reader's head. The metric improves and comprehension does not.
- **A host-only dependency.** The gate cannot run in the container, so it is one more
  member of the host/container split ADR 0002 documents, and one more binary to keep
  available on a runner.
- **No architectural signal.** These are per-function and per-file numbers. A design that
  spreads one concern across twelve compliant files scores perfectly; boundaries are
  dependency-cruiser's job, not this gate's.

### What would reverse it

Sustained evidence that the budgets force worse code rather than better — measured by
review, not by a single inconvenient PR — or rust-code-analysis becoming unmaintained,
which would move the same policy onto another analyser rather than removing the gate.
