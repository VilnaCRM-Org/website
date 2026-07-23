# AI Agent Guide to the VilnaCRM Website Skills System

For Claude Code, Codex / OpenAI agents, GitHub Copilot, Cursor, and any other AI
coding assistant working in the VilnaCRM **website** repo — the marketing site and
landing built on Next.js 16 (pages router), React 19, TypeScript 6, MUI 9 with
Emotion, Apollo Client 4 with Apollo Server 5, react-hook-form, i18next, and
Storybook 10. The package manager is `bun@1.3.5` and Node is `>=20`. Structure is
adapted from bulletproof-react. Every command is a Makefile target run from the repo
root — this repo has no `package.json` scripts.

## Overview

This repo ships a modular **skills system** under `.claude/skills/`. Each skill is
plain markdown that any AI agent can read and execute, so the workflows are
**AI-agnostic** even though Claude Code can also auto-invoke them. The skills own
**process and gates** (what to run, in what order, how to react to failures). They
sit on top of two existing contracts you must respect:

- `agents.md` — the root contract: the mandatory test-scenario coverage policy,
  behavior-first assertions, and the Definition of Done. This guide never replaces
  it; it routes you to the right skill for the change at hand.
- The Makefile — the authoritative command surface. If a command is not a `make`
  target here, do not run it.

BMAD planning and the interactive method workflows are **separate** from these
implementation skills (see "BMAD Planning" below). Do not mirror them into
`.claude/skills/`.

## How This Works Per Agent

### Claude Code

Discovers and invokes skills automatically through its `Skill` tool when a task
matches a skill description. You may also open any `SKILL.md` directly. Claude Code
additionally exposes personal / global technique skills via the same tool; treat
those as a complement to — never a replacement for — the committed project skills
and gates below.

### Codex / OpenAI, GitHub Copilot, and others

No automatic discovery. Read the skill files yourself: start at this guide, then
`SKILL-DECISION-GUIDE.md`, then the matching `<skill>/SKILL.md`, and follow its
steps in order.

### Cursor

Same manual flow. The repo also ships a top-level `cursor-project-guide.md` entry
point tuned for Cursor — read it first, then return here and to
`SKILL-DECISION-GUIDE.md` to pick the skills for your task.

## Quick Start

### Step 0: Mandatory Skill Check (every task)

Before any code, doc, config, or workflow change, do all of the following:

1. Read `agents.md` (the root contract) and this guide.
2. Read `.claude/skills/SKILL-DECISION-GUIDE.md`.
3. Identify every skill that applies to the task — a single change often needs
   several (component work usually pulls in design, testing, docs, and CI).
4. Open each matching `SKILL.md` and follow its steps. If your host exposes global
   technique skills, match them through the same decision process.
5. If a skill is plausibly relevant, read it before deciding it does not apply, and
   record `Not applicable: <reason>` (the same convention `agents.md` uses) when you
   skip it.

This check is non-negotiable. Do not hand the user implementation steps or commit
code until the relevant skills have been consulted.

### Step 1: Name the intent

Translate the request into one of these:

- Fix something broken (format, lint, types, markdown, deps, metrics, tests, CI).
- Create something new (component, feature, hook, test, doc, telemetry signal).
- Refactor existing code (move, rename, split, reduce complexity).
- Review or validate work (PR comments, CI readiness, performance or a11y audit).
- Update documentation.

### Step 2: Walk the decision tree

Read `.claude/skills/SKILL-DECISION-GUIDE.md` and follow it. The shape:

```text
What are you trying to do?
│
├─ Fix something broken
│   ├─ Format / ESLint / TypeScript / markdown / deps → frontend-quality-workflow
│   ├─ Failing Jest, e2e, or visual test → frontend-testing-workflow
│   ├─ Broader suite triage (mutation, memory-leak, load) → testing-workflow
│   ├─ File or function over the rust-code-analysis gate → complexity-management
│   └─ Is this CI-green yet? → ci-workflow
│
├─ Create something new
│   ├─ React component or feature UI → figma-design-check, then
│   │                                  frontend-component-development
│   ├─ File placement / naming / split → code-organization
│   ├─ Feature boundary or data flow (Apollo, hooks) → architecture
│   ├─ Jest, Testing Library, Playwright, or visual test → frontend-testing-workflow
│   ├─ K6 load scenario → load-testing
│   ├─ Sentry, web-vitals, or structured log → observability-instrumentation
│   └─ New repository documentation → documentation-creation
│
├─ Refactor existing code
│   ├─ Move / rename / split a file → code-organization
│   ├─ Reduce complexity → complexity-management
│   └─ Improve testability → frontend-testing-workflow / testing-workflow
│
├─ Review / validate work
│   ├─ Before commit, push, or PR → ci-workflow
│   ├─ Address PR review comments → code-review
│   ├─ make lint-deps boundary violation → architecture
│   ├─ Lighthouse, web-vitals, accessibility → frontend-performance-accessibility
│   └─ Overview of protected thresholds → quality-standards
│
└─ Update documentation
    ├─ New project needs docs → documentation-creation
    └─ Any code, command, or workflow change → documentation-sync
```

### Step 3: Read the skill file

Each skill lives at `.claude/skills/<skill-name>/SKILL.md`. Read the whole file
before executing. Example: for PR review work, read
`.claude/skills/code-review/SKILL.md`.

### Step 4: Follow the execution steps

Run every command as a Makefile target from the repo root so behavior matches CI.
Unit suites run locally without Docker when prefixed with `CI=1` (for example
`CI=1 make test-unit-all`); the heavier suites (e2e, visual, memory-leak, load,
Lighthouse) are Docker-backed and the Makefile starts the prod stack for you.

### Step 5: Load supporting files only when needed

Skills use progressive disclosure. Pull in `reference/`, `examples/`, or
`update-scenarios/` only when the active task needs the extra depth:

```text
.claude/skills/<skill-name>/
├── SKILL.md            # Core workflow — start here
├── reference/          # Deeper reference docs (patterns, troubleshooting)
├── examples/           # Worked examples
└── update-scenarios/   # Scenario-specific patterns
```

## Available Skills

### Workflow

- **ci-workflow** (`ci-workflow/SKILL.md`) — take a change from "edited" to
  "ready to push": `make format`, then focused suites, then `make lint`.
- **code-review** (`code-review/SKILL.md`) — retrieve and triage PR review comments
  via `make pr-comments` (`PR=<num> FORMAT=text|json|markdown`).
- **testing-workflow** (`testing-workflow/SKILL.md`) — select, run, and triage the
  broader suites (unit, mutation, memory-leak, load) beyond the frontend defaults.

### Frontend Implementation

- **figma-design-check** (`figma-design-check/SKILL.md`) — verify a planned UI
  change matches its design reference (theme tokens, spacing, states, visual
  baselines) before you build it.
- **frontend-component-development**
  (`frontend-component-development/SKILL.md`) — build or change React components,
  hooks, forms, and feature UI with MUI 9, Emotion, react-hook-form, Apollo, and
  i18next.
- **frontend-testing-workflow** (`frontend-testing-workflow/SKILL.md`) — write or
  fix Jest, Testing Library, Playwright e2e, and visual tests.
- **frontend-quality-workflow** (`frontend-quality-workflow/SKILL.md`) — run or fix
  formatting, ESLint, TypeScript, markdown, and dependency-cruiser findings.
- **frontend-performance-accessibility**
  (`frontend-performance-accessibility/SKILL.md`) — improve Lighthouse, web-vitals,
  and accessibility.

### Quality and Architecture

- **architecture** (`architecture/SKILL.md`) — place a feature, wire data through
  hooks and Apollo, and resolve `make lint-deps` boundary violations.
- **quality-standards** (`quality-standards/SKILL.md`) — the overview of protected
  thresholds and the commands that guard them.
- **complexity-management** (`complexity-management/SKILL.md`) — a file, component,
  hook, or helper exceeds the rust-code-analysis gate (`make lint-metrics`,
  `config/metrics-policy.json`).
- **code-organization** (`code-organization/SKILL.md`) — place, move, name (kebab-
  case), or split files within the `src/features` structure.

### Documentation, Observability, Performance

- **documentation-creation** (`documentation-creation/SKILL.md`) — create new
  repository documentation or agent guides.
- **documentation-sync** (`documentation-sync/SKILL.md`) — keep `agents.md`, READMEs,
  feature docs, and skill files aligned after a code, command, or workflow change.
- **observability-instrumentation**
  (`observability-instrumentation/SKILL.md`) — add Sentry, structured logs, or
  web-vitals signals.
- **load-testing** (`load-testing/SKILL.md`) — create, run, or debug K6 load tests
  (`make load-tests` / `make test-load`).

## BMAD Planning (separate from these skills)

BMAD planning, the interactive method, and multi-agent workflows are **not** part of
`.claude/skills/`. They are delivered by the bmalph tooling under `_bmad/` and
`bmalph/`, and surfaced as slash commands under `.claude/commands/` (for example
`/bmalph`, `/bmad-help`, `/create-prd`, `/architect`, `/dev`, `/sm`, `/qa`). Those
directories are bmalph-generated and **local-only / gitignored** — reference them,
but never mirror them into `.claude/skills/` or duplicate their content here. The
implementation skills above are intentionally kept distinct from planning.

## Practical Examples

### "Fix the failing lint"

1. Read this guide and `SKILL-DECISION-GUIDE.md`.
2. Decision tree → `frontend-quality-workflow`.
3. Run `make format` first, then `make lint` (ESLint, TypeScript, markdownlint, and
   dependency-cruiser run in sequence).
4. If the metrics gate fails, also consult `complexity-management` and run
   `make lint-metrics`.

### "Add a new feature under src/features"

1. Decision tree picks `figma-design-check`, `frontend-component-development`,
   `code-organization`, `frontend-testing-workflow`, `documentation-sync`, and
   `ci-workflow`.
2. Read each skill before touching code.
3. Use `code-organization` for placement: a kebab-case feature directory at
   `src/features/<feature>/` exposing a public `index.ts` barrel, with imports
   crossing feature boundaries only through that barrel.
4. Follow `frontend-component-development` for MUI 9, Emotion, react-hook-form, and
   i18next patterns.
5. Add Jest and Playwright coverage per `frontend-testing-workflow` and the
   `agents.md` scenario-coverage policy.
6. Update docs per `documentation-sync`, then validate with `make format`, focused
   suites, and `make lint`.

### "Address PR comments on this branch"

1. Decision tree → `code-review`.
2. Run `make pr-comments` (or `make pr-comments PR=<num> FORMAT=markdown`).
3. Categorize each comment (committable suggestion, bug, architecture, complexity,
   test gap, question) and route it to the right skill.
4. Apply fixes, then re-run `make format`, focused suites, and `make lint`.

### "Investigate a Lighthouse regression"

1. Decision tree → `frontend-performance-accessibility`.
2. Run `make lighthouse-desktop` and `make lighthouse-mobile`.
3. Cross-check web-vitals signals; consult `observability-instrumentation` if the
   telemetry needed to diagnose it is missing.
4. If the fix changes rendering cost, use `frontend-component-development` to
   implement it and `frontend-testing-workflow` to lock in regression coverage.

## Differences Between Agents

- **Discovery** — Claude Code: automatic via the `Skill` tool. Others: manual, by
  reading `SKILL-DECISION-GUIDE.md`.
- **Invocation** — Claude Code: automatic on match. Others: open and follow the
  `SKILL.md`.
- **Execution** — Claude Code: tool-guided. Others: self-guided, step by step.
- **Multi-file skills** — Claude Code: supporting files load as referenced. Others:
  read `reference/`, `examples/`, and `update-scenarios/` as needed.

## Protected Quality Thresholds

These gates MUST NOT be lowered. Route failures to the listed skill:

- ESLint — zero errors → `frontend-quality-workflow` (`make lint-next`).
- TypeScript — zero errors → `frontend-quality-workflow` (`make lint-tsc`).
- markdownlint — zero violations → `frontend-quality-workflow` (`make lint-md`).
- dependency-cruiser — no boundary violations → `architecture` /
  `code-organization` (`make lint-deps`).
- Prettier — formatted → `frontend-quality-workflow` (`make format`).
- rust-code-analysis — metrics within `config/metrics-policy.json` budgets (gate introduced
  by issue #224) → `complexity-management` (`make lint-metrics`).
- Jest / Testing Library — suites pass, coverage maintained →
  `frontend-testing-workflow` (`make test-unit-client`, `make test-unit-server`).
- Playwright e2e — suites pass → `frontend-testing-workflow` (`make test-e2e`).
- Visual regression — snapshots match → `frontend-testing-workflow`
  (`make test-visual`).
- Stryker mutation — score threshold met → `testing-workflow`
  (`make test-mutation`).
- memlab — no leaks → `testing-workflow` (`make test-memory-leak`).
- Lighthouse — no regression vs. baseline → `frontend-performance-accessibility`
  (`make lighthouse-desktop`, `make lighthouse-mobile`).
- K6 load — scenario thresholds met → `load-testing` (`make load-tests`,
  `make test-load`).

Never silence findings with `eslint-disable`, `// @ts-ignore`, `// @ts-expect-error`,
`prettier-ignore`, markdownlint disable comments, or by lowering a threshold. Fix the
root cause; if a rule genuinely does not apply, refactor so its intent still holds.

## Locked Configuration Policy

Treat the gate configs as locked: `eslint.config.mjs`, `tsconfig.json`,
`.dependency-cruiser.js`, `.markdownlint.yaml`, `.prettierrc`,
`config/metrics-policy.json`, the Jest and Playwright configs, the Mockoon E2E
fixtures, and the Stryker config. If a task truly requires changing one:

1. Confirm the user explicitly asked for it.
2. Keep the change isolated in a dedicated configuration PR.
3. Document rationale, impact, and rollback in the PR description.
4. Never route around it with disable / ignore comments.

## Common Workflows

### Before every commit or push

1. Read `ci-workflow/SKILL.md`.
2. Run `make format`, then the focused suites your change touched, then `make lint`.
3. Success criterion: `make lint` reports no findings.
4. On any failure, open the matching skill and follow its remediation.

### Creating a new feature

`figma-design-check` → `frontend-component-development` → `code-organization` →
`frontend-testing-workflow` → `observability-instrumentation` (when relevant) →
`documentation-sync` → `ci-workflow`.

### Fixing quality issues

Identify the failure type, let the decision tree pick the most specific skill, follow
its remediation, lean on `complexity-management` and `code-organization` when
refactoring, then re-run `make format` and `make lint`.

## File Structure Reference

```text
.claude/skills/
├── AI-AGENT-GUIDE.md           # This file — start here
├── SKILL-DECISION-GUIDE.md     # Decision tree for choosing skills
├── README.md                   # Skills index and overview
│
├── architecture/
├── ci-workflow/
├── code-organization/
├── code-review/
├── complexity-management/
├── documentation-creation/
├── documentation-sync/
├── figma-design-check/
├── frontend-component-development/
├── frontend-performance-accessibility/
├── frontend-quality-workflow/
├── frontend-testing-workflow/
├── load-testing/
├── observability-instrumentation/
├── quality-standards/
└── testing-workflow/
```

Each skill directory holds a `SKILL.md` plus optional `reference/`, `examples/`, and
`update-scenarios/` folders.

## Tips

### Do

- Start with `agents.md`, this guide, and `SKILL-DECISION-GUIDE.md` when unsure.
- Read the whole `SKILL.md` before executing, and follow its steps in order.
- Run `make format` before `make lint`.
- Respect protected thresholds and the rust-code-analysis complexity gate.
- Use Makefile targets so behavior matches CI; prefix unit suites with `CI=1` for
  local non-Docker runs.

### Do Not

- Skip the decision guide or jump to execution without reading the full skill.
- Lower lint, type, test, coverage, or metrics thresholds.
- Silence findings with disable / ignore annotations.
- Mirror BMAD planning commands into `.claude/skills/`.
- Document or run a command that is not a Makefile target in this repo.

## Getting Help

1. Check the skill's `reference/` folder.
2. Review the worked examples under `examples/`.
3. Re-read `agents.md` (coverage policy, Definition of Done) and the Makefile (the
   command surface).

## Conclusion

Skills are modular, reusable workflows that work across AI agents: Claude Code
invokes them automatically, and Codex, Copilot, and Cursor reach the same result by
reading and following the files. Start every task here, walk
`SKILL-DECISION-GUIDE.md`, pick every relevant skill, follow its steps, and validate
with `make format`, focused suites, then `make lint`.
