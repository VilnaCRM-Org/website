---
name: documentation-sync
description: >-
  Use when a change touches Makefile targets, the Next.js/Apollo/MUI stack, a
  src/features feature, the GraphQL schema or Apollo resolvers, i18n en/uk copy,
  dependency-cruiser boundaries, or .claude/skills, and the matching docs (agents.md,
  CLAUDE.md, README.md, CONTRIBUTING.md, feature READMEs, skill files) must be updated in
  the same change. Run make format before make lint-md and make lint.
---

# Documentation Sync

Keep docs, READMEs, and agent guides aligned with the code, commands, and tooling
they describe. Update the docs in the SAME change that alters behavior — never
leave them to drift.

## When to update docs (same change)

- A Makefile target is added, renamed, or changes behavior (including the
  complexity/metrics gate from issue #224, rust-code-analysis).
- A tooling or CI workflow changes: ESLint, TypeScript (`tsc`), markdownlint,
  dependency-cruiser, Stryker, Playwright, Mockoon, Lighthouse, K6, or Memlab.
- A `src/features/<feature>` structure, its public `index.ts` barrel, or a
  shared-layer boundary changes.
- A GraphQL schema or Apollo resolver, an Apollo mock, or a component/hook public
  API changes.
- i18n copy (`src/features/<feature>/i18n/{en,uk}.json`) or validation messages
  that existing docs describe change.
- The `.claude/skills` layout or guidance changes.

## Where website docs live (check the closest owner first)

- `agents.md` — the root AI-agent contract (test-coverage policy, behavior-first
  assertions, Definition of Done). markdownlint-scanned.
- `CLAUDE.md` — agent quick-reference. markdownlint-ignored but Prettier-checked.
- `README.md`, `CONTRIBUTING.md` — contributor-facing. markdownlint-scanned.
- `src/features/<feature>/` — the feature-local docs and i18n the feature owns.
- `.claude/skills/<skill>/` — website implementation skill guides (this tree).
- Makefile help text — the `## ...` description after each target is the
  command surface of record.

## Sync rules

- `.claude/skills/` holds website implementation skills. The BMAD/bmalph planning
  surface (`_bmad/`, `bmalph/`, `.claude/commands/`) is bmalph-generated and
  local-only — reference it, never duplicate it into a skill here.
- `make format` runs Prettier only — there is no `qlty`, `jscpd`, or
  `make fmt-*` step on website. Describe it as "Prettier" and do not invent one.
- Reference commands by their make target. Do not paste the raw `pnpm`, `eslint`,
  or `tsc` invocations the Makefile already wraps.
- Keep website docs website-specific. Do not copy CRM or sister-repo backend,
  dependency-injection, Zustand, or Redux/RTK Query details into these docs.
- In examples, import a feature through its `index.ts` barrel — never a deep
  `@/features/<feature>/...` path (dependency-cruiser forbids it).

## Verification

```bash
make format    # Prettier (run first)
make lint-md   # markdownlint (scanned docs only)
make lint      # ESLint + tsc + markdownlint + dependency-cruiser
```

Run `make lint` whenever docs changed alongside code.

## Line-length disclosure

Before presenting changes, scan the changed markdown for lines longer than 100
characters (markdownlint `MD013` line_length is 100). Report each `path:line`
and its measured length as disclosure. Treat it as a failure only when
`make lint-md` actually fails — it does not scan `.claude/skills/**` or
`CLAUDE.md`, so those stay clean through `make format` instead.

## Related guides

Before applying this skill, confirm the active task against
[../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill
is consulted.

## Supporting files

- [reference/quality-standards.md](reference/quality-standards.md): doc quality
  rules for commands, examples, and cross-references.
- [reference/workflow-checklist.md](reference/workflow-checklist.md): the sync
  flow, step by step.
- [update-scenarios/tooling-and-agent-skills.md](update-scenarios/tooling-and-agent-skills.md):
  Makefile, CI, and skill-layout doc updates.
- [update-scenarios/testing-and-quality.md](update-scenarios/testing-and-quality.md):
  testing, formatting, lint, and metrics doc updates.
- [update-scenarios/frontend-features.md](update-scenarios/frontend-features.md):
  feature-level documentation updates.
