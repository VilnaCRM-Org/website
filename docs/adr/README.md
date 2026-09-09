# Architecture Decision Records

This directory is the durable record of the load-bearing decisions this repository has
made. Before ADRs existed, the reasoning behind the static export, the container-always
execution model, and the CI layout lived only in PR threads — invisible to a new
maintainer and to any agent acting on documented state (issue #341).

An ADR captures the decision **and its cost**. A record that lists only benefits is
useless: the value of the log is that the next person can tell whether the trade-off that
justified a decision still holds.

## Index

- [ADR 0001](0001-static-export-s3-cloudfront.md) — ship a static export to S3 +
  CloudFront, deployed by CodePipeline. _Accepted._
- [ADR 0002](0002-container-always-execution.md) — run every gate in the dev container,
  with `EXEC_MODE=host` as the escape hatch. _Accepted._
- [ADR 0003](0003-parallel-per-check-pipeline.md) — one workflow per PR check, running in
  parallel. _Accepted._
- [ADR 0004](0004-complexity-gate.md) — gate code complexity with rust-code-analysis, and
  never lower a threshold. _Accepted._

The template for a new record is [`0000-template.md`](0000-template.md).

## When an ADR is required

Write one when a change would be expensive to reverse, or when a future reader would
otherwise have to reconstruct the reasoning from a diff. Concretely:

- A deployment, hosting, or delivery-model change (what CloudFront serves, how it is
  published).
- A change to where code executes — the container/host boundary, the CI topology.
- Adding, removing, or restructuring a quality gate, or changing what a gate is allowed
  to block on.
- Adopting or dropping a framework, a data layer, or a cross-cutting library.
- Deliberately accepting a divergence a gate would otherwise flag (for example two
  runtime versions kept alive on purpose), together with the trigger that ends it.

Routine work does not need one: a component, a bug fix, a dependency bump, a test, or a
copy change.

## Statuses

- **Proposed** — written, not yet agreed. Merging a Proposed ADR is fine; it records that
  the option is on the table.
- **Accepted** — in force. The repository behaves this way today.
- **Superseded by ADR-NNNN** — replaced. The old record stays, with a forward link; never
  delete or rewrite history.
- **Deprecated** — no longer in force and not replaced by anything.

## Numbering and file names

Four digits, allocated in order, never reused: `NNNN-kebab-case-title.md`. `0000` is
reserved for the template. If two open PRs claim the same number, the second one to merge
renumbers — the number is an identifier, not a priority.

Keep each record short. It states one decision, in the tense it was made, and is not
edited afterwards except to change its status.

## Related documents

- [Deployment and rollback runbook](../deployment-runbook.md) — the operational detail
  behind ADR 0001.
- [Security headers](../security-headers.md) — why the CloudFront edge is the only
  enforcement point under a static export.
- The image, font, and transfer-size sustainability policy referenced by ADR 0001 lives
  in the [frontend performance and accessibility skill][perf-skill].

[perf-skill]: ../../.claude/skills/frontend-performance-accessibility/SKILL.md
