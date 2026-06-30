# Skill Decision Guide

**Pick the right `.claude/skills` workflow for the task you are about to do in the
VilnaCRM website repo.** This is the index; each linked `SKILL.md` is the detail.

**Non-negotiable rule**: fix root causes. Never silence ESLint, TypeScript, Prettier,
markdownlint, dependency-cruiser, or the rust-code-analysis metrics gate with
`eslint-disable`, `// @ts-ignore`, `// @ts-nocheck`, `// @ts-expect-error`, `// prettier-ignore`,
a markdownlint disable comment, a
dependency-cruiser exclusion, or a lowered threshold. Reduce the problem instead, and run
everything through the `make` targets.

## Mandatory Skill Check (every task)

Before any code, doc, or workflow change you MUST:

1. Open `.claude/skills/AI-AGENT-GUIDE.md` (the repo entry point and stack contract).
2. Open this file (`.claude/skills/SKILL-DECISION-GUIDE.md`).
3. Identify every skill that applies — **both** the project `.claude/skills` workflows in
   the decision tree below **and** the global `~/.claude/skills` techniques in the
   [Global Skills](#global-skills-claudeskills--task--skill-map) table. Scan both lists; a
   task usually needs one of each.
4. Read each matching project `.claude/skills/<skill>/SKILL.md`, and invoke each matching
   global skill **by name** with the Skill tool, before executing.
5. If a skill is plausibly relevant, read or invoke it first; only skip it after recording
   "Not applicable" with a concrete reason.

Project skills own process and the CI gates (run them first); global skills add deeper,
technique-level guidance. The decision tree selects the primary project skill — it does not
replace this mandatory pass or the global table.

## Global Skills (`~/.claude/skills`) — Task → Skill Map

These personal skills are installed globally (not committed in this repo) and are available
in every project through the Skill tool. They are **part of the mandatory pass above**: when
a task matches a trigger, invoke the named skill(s) by name alongside the project workflow
skills. Project skills own process and gates; reach here for deeper technique.

**Stack note:** several UI skills assume Tailwind CSS or shadcn/ui. This project uses
**MUI 9 + Emotion** — keep their design principles but translate utility-class / token
guidance to MUI's `sx`, `styled()`, and `theme`.

**Accessibility note:** the a11y skills below are technique guidance. Pair them with the
project [frontend-performance-accessibility](frontend-performance-accessibility/SKILL.md)
workflow and its Lighthouse / web-vitals gates — invoke the global skill for the fix, run the
project workflow for the audit and verification.

| When the task is…                                             | Invoke (global `~/.claude/skills`)                                                                                                                              |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build / beautify a component, page, dashboard, or SaaS UI     | `frontend-design`, `interface-design`, `frontend-ui-engineering`, `bencium-innovative-ux-designer`, `design-taste-frontend`, `ui-ux-pro-max`                    |
| Add polish / micro-detail to existing UI                      | `emil-design-eng`, `make-interfaces-feel-better`                                                                                                                |
| Explore several design directions before committing           | `design-lab`                                                                                                                                                    |
| Redesign / upgrade existing UI to premium quality             | `redesign-existing-projects`, `web-design-reviewer`                                                                                                             |
| Review UI against design / interface guidelines               | `web-design-guidelines`, `rams`                                                                                                                                 |
| Design system, grid, typography, minimal / editorial layout   | `swiss-design`, `minimalist-ui`, `baseline-ui`                                                                                                                  |
| Color: palettes, contrast, dark mode (OKLCH)                  | `oklch-skill`                                                                                                                                                   |
| Motion, transitions, animation, icon morphs, view transitions | `interaction-design`, `transitions-dev`, `12-principles-of-animation`, `to-spring-or-not-to-spring`, `morphing-icons`, `pseudo-elements`                        |
| Animation jank / motion performance                           | `fixing-motion-performance`                                                                                                                                     |
| Fix a11y: ARIA, keyboard nav, focus, contrast, form errors    | `fixing-accessibility`                                                                                                                                          |
| WCAG audit and remediation                                    | `wcag-audit-patterns`                                                                                                                                           |
| Automated a11y testing (axe-core, Playwright, DevTools)       | `accessibility-testing`, `a11y-playwright-testing`, `a11y-debugging`                                                                                            |
| SEO / metadata: titles, canonical, Open Graph, JSON-LD        | `fixing-metadata`                                                                                                                                               |
| React health scan (lint, a11y, bundle, architecture)          | `react-doctor`                                                                                                                                                  |
| Static visual art (poster, `.png` / `.pdf`)                   | `canvas-design`                                                                                                                                                 |
| Write / debug / structure Playwright tests                    | `playwright-best-practices`, `playwright-automation`, `playwright-e2e-testing`, `playwright-regression-testing`, `playwright-skill`, `playwright-generate-test` |
| Visual regression / screenshot testing                        | `visual-testing`                                                                                                                                                |
| Heal one flaky test at runtime                                | `test-reliability`                                                                                                                                              |
| Jest units, mocking, coverage, test doubles                   | `unit-testing`, `javascript-typescript-jest`                                                                                                                    |
| Migrate Enzyme tests to React Testing Library                 | `react18-enzyme-to-rtl`                                                                                                                                         |
| Choose test selectors (avoid `data-testid`)                   | `semantic-test-selectors`                                                                                                                                       |
| REST / GraphQL endpoint, schema, contract testing             | `api-testing`                                                                                                                                                   |
| Test plans, manual cases, regression suites, bug reports      | `qa-test-planner`                                                                                                                                               |
| Performance profiling, Web Vitals budgets, K6                 | `performance-optimization`, `performance-testing`                                                                                                               |
| Diagnose / improve LCP                                        | `debug-optimize-lcp`                                                                                                                                            |
| Memory leaks / OOM (heapsnapshots, memlab)                    | `memory-leak-debugging`                                                                                                                                         |
| React render / bundle performance patterns                    | `vercel-react-best-practices`                                                                                                                                   |
| React 18.3 / 19 dependency compatibility                      | `react18-dep-compatibility`                                                                                                                                     |
| TypeScript clean-code refactor                                | `typescript-clean-code`                                                                                                                                         |
| Duplicate code / DRY refactor                                 | `eliminating-duplication`                                                                                                                                       |
| Storybook stories (CSF3)                                      | `storybook-story-writing`                                                                                                                                       |
| Drive a real browser: DOM, console, network, perf             | `chrome-devtools`, `browser-testing-with-devtools`, `webapp-testing`                                                                                            |
| Lighthouse-style perf / a11y / SEO audit                      | `web-quality-audit`                                                                                                                                             |
| Pixel-perfect Figma → code loop                               | `pix`                                                                                                                                                           |
| Harden GitHub Actions token permissions                       | `hardening-github-actions-permissions`                                                                                                                          |

## New Feature / Significant Change Verification Gate

**Before implementing any user-visible part**, run
[figma-design-check](figma-design-check/SKILL.md) to confirm the planned UI matches the Figma
design (via the Figma MCP); ask for the Figma reference if none is known.

If the change introduces a new feature, route, component family, telemetry signal, GraphQL
document, or other user-facing behavior, run **every** project skill below after
implementation:

**Execution rules:**

1. Open each `SKILL.md` listed.
2. Follow its steps exactly. Record "Not applicable" with a concrete reason when a skill does
   not apply.
3. Run required commands through `make` targets only.
4. Provide evidence in your response: commands run and outcomes.
5. Do not declare the work complete until this gate is finished.

**Skills to execute for every new feature:**

- `architecture`
- `ci-workflow`
- `code-organization`
- `code-review`
- `complexity-management`
- `documentation-creation`
- `documentation-sync`
- `frontend-component-development`
- `frontend-performance-accessibility`
- `frontend-quality-workflow`
- `frontend-testing-workflow`
- `load-testing`
- `observability-instrumentation`
- `quality-standards`
- `testing-workflow`

## Quick Decision Tree

```text
What are you trying to do?
│
├─ Fix something broken
│   ├─ ESLint, Prettier, tsc, markdownlint, or dependency-cruiser → frontend-quality-workflow
│   ├─ Function/file over the rust-code-analysis metrics gate → complexity-management
│   ├─ Failing Jest, Testing Library, Playwright e2e, or visual snapshot → frontend-testing-workflow
│   ├─ Broad / cross-suite triage → testing-workflow
│   ├─ Lighthouse, web-vitals, or a11y regression → frontend-performance-accessibility
│   └─ CI readiness before commit / push / PR → ci-workflow
│
├─ Create something new
│   ├─ ANY UI / visual change → figma-design-check BEFORE writing or editing the UI code
│   ├─ React component, hook, form, or feature UI → frontend-component-development
│   ├─ File placement, naming, kebab-case, public-API barrel → code-organization
│   ├─ New feature or data-flow / import boundary → architecture
│   ├─ Jest, Testing Library, Playwright, or visual test → frontend-testing-workflow
│   ├─ K6 load scenario → load-testing
│   ├─ Sentry, web-vitals, or structured log signal → observability-instrumentation
│   └─ Project docs suite from scratch → documentation-creation
│
├─ Refactor existing code
│   ├─ Move / rename / split files → code-organization
│   ├─ Reduce cyclomatic, cognitive, ABC, NARGS, or file size → complexity-management
│   ├─ Improve testability → frontend-testing-workflow / testing-workflow
│   └─ Tighten an observability boundary → observability-instrumentation
│
├─ Review / validate work
│   ├─ Before commit, push, or PR → ci-workflow
│   ├─ Address PR review comments → code-review
│   ├─ make lint-deps boundary violation → architecture
│   ├─ Confirm the protected thresholds → quality-standards
│   └─ Lighthouse / web-vitals / a11y audit → frontend-performance-accessibility
│
└─ Update documentation
    ├─ New project / suite needs docs → documentation-creation
    └─ Any code, command, tool, or workflow change → documentation-sync
```

## Scenario-Based Guide

### "ESLint, Prettier, tsc, markdownlint, or dependency-cruiser is failing"

**Use**: [frontend-quality-workflow](frontend-quality-workflow/SKILL.md).

Runs `make format` (Prettier) first so the mutating formatter does not race the read-only
`make lint` gate (`lint-next` + `lint-tsc` + `lint-md` + `lint-deps`).

**NOT**: `complexity-management` unless the rust-code-analysis metrics gate specifically fails.

---

### "rust-code-analysis hard-fail metrics tripped"

**Use**: [complexity-management](complexity-management/SKILL.md).

Use named helpers, smaller files, lookup maps, and typed options objects to bring function and
file metrics back under the hard-fail budgets in `config/metrics-policy.json`, surfaced by
`make lint-metrics`.

**NOT**: lowering a threshold or excluding a file in `config/metrics-policy.json`.

---

### "Jest, Testing Library, Playwright, or visual snapshots fail"

**Use**: [frontend-testing-workflow](frontend-testing-workflow/SKILL.md).

Covers `make test-unit-client` (jsdom, `TEST_ENV=client`), `make test-unit-server` (node,
`TEST_ENV=server`), `make test-e2e` (Mockoon-backed), `make test-visual`, snapshot updates via
`make test-visual-update`, and the `src/test/` suite layout.

**NOT**: `testing-workflow` when you already know the specific suite.

---

### "I need to pick the right suite or triage a broad failure"

**Use**: [testing-workflow](testing-workflow/SKILL.md).

Routes to unit, e2e, visual, memory-leak (memlab), mutation (Stryker), or load (K6) suites and
explains the `TEST_ENV=client` vs `TEST_ENV=server` Jest environment split.

---

### "I am building or changing a React component, hook, or feature UI"

**FIRST (before any visual change)**:
[figma-design-check](figma-design-check/SKILL.md) — verify the planned change matches the Figma
design via the Figma MCP. If the change alters anything the user sees (color, layout, spacing,
typography, sizing, or an interaction state), run this gate before writing or editing the UI
code; ask for the Figma reference if none is known.

**Use**: [frontend-component-development](frontend-component-development/SKILL.md).

Enforces the shared-UI `ui-*` prefix, MUI 9 + Emotion patterns, react-hook-form forms,
Apollo Client `useQuery` / `useMutation` data access, and per-feature i18n (`i18n/en.json`,
`i18n/uk.json`).

**ALSO**: [code-organization](code-organization/SKILL.md) for placement, and
[frontend-testing-workflow](frontend-testing-workflow/SKILL.md) for tests.

---

### "I need to move, rename, or split a frontend file"

**Use**: [code-organization](code-organization/SKILL.md).

Confirms placement across `src/features/<feature>/{components,api,hooks,helpers,i18n,types,
constants}`, the shared layers (`src/components`, `src/hooks`, `src/lib`, `src/providers`,
`src/shared`, `src/utils`, `src/config`, `src/types`), and the `src/test/` mirror; enforces the
`@/` path alias, kebab-case names, and the feature public-API barrel.

---

### "Where should this feature, hook, or data flow live?"

**Use**: [architecture](architecture/SKILL.md).

Embeds the layered Component → Hook → Apollo data → GraphQL API flow, the feature catalog, and
every `dependency-cruiser` boundary rule (`features-import-via-public-api`,
`no-cross-feature-imports`, `no-shared-layers-to-features`, `feature-allowed-folders`,
`src-feature-name-kebab-case`). Use it when `make lint-deps` fails or a data flow crosses
features.

**ALSO**: [code-organization](code-organization/SKILL.md) for the kebab-case naming rules, and
[frontend-component-development](frontend-component-development/SKILL.md) for the implementation.

---

### "I need to add Lighthouse, web-vitals, or accessibility coverage"

**Use**: [frontend-performance-accessibility](frontend-performance-accessibility/SKILL.md).

Runs `make lighthouse-desktop` and `make lighthouse-mobile`, and audits web-vitals plus
accessibility per the Lighthouse categories.

**NOT**: `load-testing` (that targets traffic patterns, not render cost).

---

### "I need K6 load coverage for a flow"

**Use**: [load-testing](load-testing/SKILL.md).

Smoke / average / stress / spike scenarios via `make test-load` (homepage) and
`make test-load-swagger`, with K6 scripts under `src/test/load/` (`homepage.js`, `swagger.js`,
`config.json.dist`) mounted at `/loadTests/...` in the container.

---

### "I need Sentry, structured logs, or web-vitals telemetry"

**Use**: [observability-instrumentation](observability-instrumentation/SKILL.md).

Adds frontend signals via `@sentry/react` / `@sentry/node`, error boundaries, Next.js
web-vitals reporting, and analytics-safe payloads.

---

### "I am addressing PR review comments"

**Use**: [code-review](code-review/SKILL.md).

Runs `make pr-comments` (`PR=<num> FORMAT=<text|json|markdown>`) and walks the comment
categories (committable suggestion, bug, architecture, complexity, test gap, question).

**NOT**: `ci-workflow` (that runs the gate, not the comment workflow).

---

### "I need to validate before commit, push, or PR"

**Use**: [ci-workflow](ci-workflow/SKILL.md).

Sequences `make format`, the focused test suites for the change, and `make lint`. Documents
which suites to add for which kind of change.

---

### "I want to understand which quality metrics are protected"

**Use**: [quality-standards](quality-standards/SKILL.md).

Indexes the ESLint, TypeScript, markdownlint, Prettier, dependency-cruiser, rust-code-analysis,
Jest, Stryker, Playwright, visual, Lighthouse, and K6 thresholds.

**NOT**: `complexity-management` (that is specifically the rust-code-analysis metrics gate).

---

### "I need to update docs after a code or workflow change"

**Use**: [documentation-sync](documentation-sync/SKILL.md).

Provides update scenarios for testing-and-quality, build, command-surface, and agent-guide
changes.

---

### "I need to create the documentation suite from scratch"

**Use**: [documentation-creation](documentation-creation/SKILL.md).

Templates for feature READMEs, agent guides, and project documentation.

**NOT**: `documentation-sync` (that is for updates).

## Skill Relationship Map

```text
                       quality-standards
                       (thresholds & routing)
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
 frontend-quality-       complexity-           frontend-performance-
   workflow              management            accessibility
        │                     │                       │
        └─────────┬───────────┘                       │
                  ▼                                   ▼
          code-organization                    load-testing
                  │                                   │
                  ▼                                   ▼
   frontend-component-              observability-instrumentation
   development
                  │
                  ▼
      frontend-testing-workflow ──► testing-workflow
                  │
                  ▼
        code-review ──► ci-workflow
                  │
                  ▼
   documentation-sync ──► documentation-creation
```

## Common Confusions

| Confusion                                             | Clarification                                                                                                                                 |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| frontend-quality-workflow vs complexity-management    | **ESLint, Prettier, tsc, markdownlint, deps** → frontend-quality-workflow<br>**Function/file metrics over hard-fail** → complexity-management |
| testing-workflow vs frontend-testing-workflow         | **Broad suite routing / triage** → testing-workflow<br>**Specific Jest / RTL / Playwright / visual work** → frontend-testing-workflow         |
| ci-workflow vs frontend-quality-workflow              | **Order, scope, and the full gate** → ci-workflow<br>**Tooling specifics for format / lint** → frontend-quality-workflow                      |
| frontend-performance-accessibility vs load-testing    | **Render cost / a11y / Lighthouse** → frontend-performance-accessibility<br>**Traffic load (K6)** → load-testing                              |
| code-organization vs complexity-management            | **Move / rename / split for structure** → code-organization<br>**Reduce code complexity metrics** → complexity-management                     |
| documentation-creation vs documentation-sync          | **Create a new docs suite** → documentation-creation<br>**Update existing docs** → documentation-sync                                         |
| code-review vs ci-workflow                            | **Resolve PR comments** → code-review<br>**Pre-commit / pre-push gate** → ci-workflow                                                         |
| observability-instrumentation vs frontend-performance | **Add signals (Sentry, logs, web-vitals emit)** → observability-instrumentation<br>**Audit results** → frontend-performance-accessibility     |
| architecture vs code-organization                     | **Layers, data flow, lint-deps boundaries** → architecture<br>**Where a file goes, naming, barrels** → code-organization                      |

## Multi-Skill Workflows

### Creating a complete new feature

1. `architecture` — confirm the layer for each new file and the data-flow / import boundary.
2. `frontend-component-development` — React, MUI 9, Emotion, react-hook-form, i18n.
3. `code-organization` — feature placement and the public-API barrel.
4. `frontend-testing-workflow` — Jest, RTL, Playwright e2e, visual coverage.
5. `observability-instrumentation` — telemetry where relevant.
6. `documentation-sync` — docs and READMEs.
7. `ci-workflow` — validate everything.

### Fixing a failing quality gate

1. `frontend-quality-workflow` — format, ESLint, types, markdown, deps.
2. `complexity-management` — reduce metrics if the rust-code-analysis gate trips.
3. `code-organization` — refactor placement if needed.
4. `frontend-testing-workflow` — update tests broken by the refactor.
5. `ci-workflow` — final validation.

### Performance and accessibility regression

1. `frontend-performance-accessibility` — measure with Lighthouse / web-vitals.
2. `frontend-component-development` — implement the render-cost fix.
3. `observability-instrumentation` — ensure the regression signal is captured.
4. `load-testing` — validate behavior under traffic if relevant.
5. `frontend-testing-workflow` — lock in regression coverage.
6. `ci-workflow` — final validation.

### Refactoring existing code

1. `code-organization` — verify placement and naming.
2. `complexity-management` — simplify dense functions or files.
3. `frontend-testing-workflow` — ensure tests still cover the refactor.
4. `documentation-sync` — update docs if commands or APIs change.
5. `ci-workflow` — final validation.

### Addressing PR review comments

1. `code-review` — retrieve and categorize comments.
2. The skill matching the comment topic (component, test, docs, metrics, architecture).
3. `frontend-quality-workflow` — format and lint.
4. `ci-workflow` — validate before pushing changes.
