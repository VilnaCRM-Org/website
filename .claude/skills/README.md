# AI Agent Skills (Claude Code, OpenAI, GitHub Copilot, Cursor)

This directory holds modular, **AI-agnostic skills** for the VilnaCRM marketing
website — a Next.js 16 (pages router) + React 19 + TypeScript 6 app using MUI 9 +
Emotion, Apollo Client 4 (with a local Apollo Server 5 mock), react-hook-form, and
i18next. The files are plain Markdown that any agent can read and follow.

BMAD planning and interactive-method workflows live separately under `_bmad/`,
`bmalph/`, and `.claude/commands/` (the `/bmalph`, `/create-prd`, `/architect`,
`/dev`, `/sm`, `/qa` slash commands). Do **not** mirror those planning skills here.

## For Different AI Agents

### Claude Code

Skills are discovered and invoked automatically when relevant. Nothing extra is
required.

### OpenAI, GitHub Copilot, Cursor, and Other Agents

**Start here**: read [AI-AGENT-GUIDE.md](AI-AGENT-GUIDE.md) for cross-platform usage.

**Quick start**:

1. Read [SKILL-DECISION-GUIDE.md](SKILL-DECISION-GUIDE.md) to choose the right skill.
2. Open the skill's `SKILL.md`.
3. Follow the execution steps.
4. Load supporting files (`reference/`, `examples/`, `update-scenarios/`) only when
   needed.

## Mandatory Skill Check (All Skills)

**Before any code, doc, or workflow change** you MUST:

1. Open [AI-AGENT-GUIDE.md](AI-AGENT-GUIDE.md).
2. Open [SKILL-DECISION-GUIDE.md](SKILL-DECISION-GUIDE.md).
3. Identify every skill below that applies to the active task.
4. Read each matching `SKILL.md` before executing.
5. Skip a skill only after recording `Not applicable: <reason>` with a concrete
   reason (this mirrors the test-coverage policy in the root `agents.md`).

## New Feature Verification Gate

For any **new feature** (new behavior, route, component family, telemetry signal,
schema, or user-facing change), run **every** skill in `.claude/skills/` **after
implementation**:

1. Open each `SKILL.md` and follow its steps. Record `Not applicable: <reason>`
   when a skill does not apply.
2. Run required commands via `make` targets only.
3. Provide evidence in your response: commands run and outcomes.
4. Do not declare the feature complete until this gate is finished.

## Available Skills

### Architecture & organization

- **architecture** — the layered Component → Hook → Apollo-data → API flow, the
  `src/features/<feature>` layout, and the import boundaries enforced by
  `make lint-deps`. Key commands: `make lint-deps`, `make format`, `make lint`.
- **code-organization** — where a component, hook, helper, api call, type, constant,
  or i18n string belongs; feature-allowed-folders, the public-API `index.ts` barrel,
  `ui-*` shared components, kebab-case names. Key commands: `make lint-deps`,
  `make format`, `make lint`.

### Building UI

- **figma-design-check** — verify a planned UI change against its design reference
  and the theme tokens before building. Key commands: `make test-visual`,
  `make test-visual-update`.
- **frontend-component-development** — build MUI 9 + Emotion components, react-hook-form
  forms, hooks, and per-feature i18n. Key commands: `make format`, `make lint`,
  `make test-unit-client`, `make test-e2e`, `make test-visual`.
- **frontend-performance-accessibility** — Lighthouse budgets, Core Web Vitals
  (LCP/CLS/INP), and accessible markup. Key commands: `make lighthouse-desktop`,
  `make lighthouse-mobile`, `make test-visual`.
- **observability-instrumentation** — Sentry browser init, error boundaries,
  `captureException` tagging, the no-PII payload contract, and `reportWebVitals`.
  Key commands: `make format`, `make lint`, `make test-unit-client`.

### Testing

- **testing-workflow** — pick which suite to run (unit, e2e, visual, mutation,
  memory-leak, load) and triage failures. Key commands: `make test-unit-all`,
  `make test-e2e`, `make test-visual`, `make test-mutation`, `make test-load`.
- **frontend-testing-workflow** — write/fix Jest (client jsdom / server node),
  Playwright e2e (Mockoon-backed), and visual snapshots. Key commands:
  `make test-unit-client`, `make test-unit-server`, `make test-e2e`,
  `make test-visual`, `make test-visual-update`.
- **load-testing** — author and run K6 scenarios under `src/test/load`. Key commands:
  `make test-load`, `make load-tests`, `make test-load-swagger`.

### Quality & review

- **ci-workflow** — sequence `make format` → focused tests → `make lint` before a
  commit or PR. Key commands: `make format`, `make lint`, `make ci-lint`,
  `make ci-test`.
- **frontend-quality-workflow** — run and fix the format/lint gates. Key commands:
  `make format`, `make lint-next`, `make lint-tsc`, `make lint-md`, `make lint-deps`,
  `make lint-metrics`.
- **quality-standards** — index of what each gate enforces and which specialist skill
  fixes a given failure. Key commands: `make lint`, `make lint-metrics`,
  `make test-unit-client`, `make test-e2e`, `make test-visual`.
- **complexity-management** — reduce file/function/component complexity flagged by the
  rust-code-analysis gate without lowering thresholds. Key commands:
  `make lint-metrics`, `make format`, `make lint`.
- **code-review** — retrieve and resolve PR review comments and route them to the
  right skill. Key commands: `make pr-comments`, `make format`, `make lint`.

### Documentation

- **documentation-creation** — author feature READMEs, agent guides, and `SKILL.md`
  files that pass the Markdown gates. Key commands: `make format`, `make lint-md`,
  `make lint`.
- **documentation-sync** — keep `agents.md`, `CLAUDE.md`, READMEs, and skill files
  aligned with code, command, and tooling changes. Key commands: `make format`,
  `make lint-md`, `make lint`.

## How Skills Work

Each skill is a directory with a `SKILL.md` carrying YAML frontmatter:

```yaml
---
name: skill-name
description: What this skill does and when to use it.
---
```

Complex skills add `reference/` (troubleshooting, configuration), `examples/`
(worked examples), and `update-scenarios/` files, loaded only when needed.

When creating a new skill: use lowercase-hyphen naming, write a precise description
with concrete trigger terms, keep `SKILL.md` focused (target < 300 lines), reuse
`make` commands, and never instruct disabling, ignoring, or suppressing a linter.

## Skill vs CLAUDE.md vs agents.md

- **CLAUDE.md** (repo root) — concise project instructions auto-loaded by Claude Code:
  stack, command map, and the metrics policy.
- **agents.md** (repo root) — the comprehensive contract, including the mandatory
  test-coverage policy (positive / negative / edge) and behavior-first assertions.
- **Skills** (`.claude/skills/`) — modular, task-specific workflows, routed via
  [AI-AGENT-GUIDE.md](AI-AGENT-GUIDE.md) and [SKILL-DECISION-GUIDE.md](SKILL-DECISION-GUIDE.md).

## Success Metrics

Every skill upholds these project standards:

- `make lint` reports zero findings, and `make format` leaves no changes.
- The rust-code-analysis budgets in `config/metrics-policy.json` pass.
- Jest, Playwright e2e, and visual suites pass.
- Lighthouse desktop and mobile budgets do not regress.
- Documentation stays synchronized with code.
- No disable / ignore / suppress directives are introduced.
