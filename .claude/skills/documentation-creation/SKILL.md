---
name: documentation-creation
description: Use when authoring or updating documentation in the VilnaCRM website repo — feature READMEs under src/features, agent guides and SKILL.md skill docs under .claude/skills, or any Markdown that must pass make lint-md and make format. Covers website conventions (Next.js pages router, MUI 9, Apollo Client 4, react-hook-form, i18next), the two Markdown linting classes, and the verification gates.
---

# Documentation Creation

Create docs that help the next contributor act correctly in this Next.js marketing
website. Prefer short, command-oriented guidance over background prose. Every path,
command, and convention you write MUST exist in the live repo — read it, do not guess.

## When To Use

- Writing a feature README under `src/features/<feature>/README.md`.
- Writing an agent guide or a `SKILL.md` (plus its `reference/` and `examples/`) under
  the `.claude/skills` tree.
- Adding or editing any Markdown that `make lint-md` scans.
- Documenting a workflow, command, or convention for future agents.

## Scope And Audience

State the audience (contributor or AI agent) and the task the doc supports up front.
Documentation here is reference material, not narrative: link real files, name real
Makefile targets, and stop. Do not recreate `AGENTS.md` — link to it as the root contract.

## Ground Every Claim In The Repo

Before you write a fact, read its source:

- `AGENTS.md` — test-coverage policy, behavior-first assertions, Definition of Done.
- `Makefile` — the only sanctioned command surface (run things via `make` targets).
- `.dependency-cruiser.js` — feature/import boundaries surfaced by `make lint-deps`.
- `eslint.config.mjs`, `tsconfig.json`, `package.json` — real gates and versions.
- `.markdownlint.yaml`, `.prettierrc` — the Markdown and formatting rules below.
- `src/features/<feature>/` and `pages/` — the real structure.

If a topic has no website equivalent, adapt it to the real mechanism or omit it. Never
document a tool that is absent here: there is no Bun, Zustand, Redux, tsyringe/DI,
React Router, jscpd, or `make fmt-qlty` in this repo.

## Two Markdown Classes (website-specific — get this right)

`make lint-md` runs markdownlint over the repo Markdown glob with a few ignores
(`CHANGELOG.md`, `CLAUDE.md`, `_bmad`, `bmalph`, `specs`, report dirs). That splits docs
into two classes with different rules:

1. **Markdownlint-scanned** — feature READMEs and most repo `.md` files. These obey every
   `.markdownlint.yaml` rule. The sharp edges: fenced code may use only the `bash`
   language (MD040 `allowed_languages: ['bash']` — `ts`, `json`, and `text` all fail);
   lines (incl. code and headings) stay at or under 100 chars (MD013); exactly one H1
   (MD025); a blank line wraps every heading, list, and fence (MD022/MD031/MD032).
2. **Skill docs in the `.claude/skills` tree** — markdownlint's `**/*.md` glob does not
   descend into dot-directories, so `make lint-md` skips `.claude/skills/**`. You MAY use
   `ts`, `tsx`, and `json` fences here. BUT `.prettierignore` only excludes `CHANGELOG.md`, so
   `make format` (Prettier) still formats these files, embedded code included. Every
   embedded `ts`, `tsx`, or `json` block MUST be valid and prettier-clean per
   `.prettierrc` (printWidth 100, singleQuote, semi, trailingComma es5, arrowParens
   avoid, 2-space indent). For a partial or pseudo snippet that would not parse, use a
   `text` fence so Prettier leaves it untouched.

## Required Content

**Feature README** (`src/features/<feature>/README.md`):

- Purpose: the user-facing workflow the feature supports.
- Key files: entry barrel `index.ts`, `components/`, `api/`, `hooks/`, and
  `i18n/en.json` + `i18n/uk.json`. A feature root may only hold the index barrel and
  these folders — `api`, `assets`, `components`, `constants`, `helpers`, `hooks`, `i18n`,
  `routes`, `types`, `utils` (enforced by the `feature-allowed-folders` cruiser rule).
- Conventions: kebab-case directory names (`src-feature-name-kebab-case` rule), import
  the feature via its public-API barrel (not deep paths), forms use react-hook-form,
  user-facing strings come from i18next `t()` and are asserted as localized text.
- Verification: the test layers that exercise the feature, then the lint gate.

**Agent guide / skill doc** (`.claude/skills/<skill>/`): one topic per `SKILL.md`, with
YAML frontmatter (`name:` kebab-case, a `description:` carrying concrete trigger terms),
and depth pushed into `reference/` and `examples/`. Keep `SKILL.md` focused.

## Markdown Standards For Scanned Docs

- ATX headings (`#`), one H1, no trailing punctuation in headings (MD026).
- `-` for unordered lists; `1.` for ordered lists (MD029 `one_or_ordered`).
- Fenced code blocks only with the `bash` language; keep shell, not TS, in scanned docs.
- Wrap lines at or under 100 chars; no hard tabs (MD010); no bare URLs — use links.
- Exactly one trailing newline (MD047); at most one blank line between blocks (MD012).

## Verification

Run formatting first, then the Markdown linter, then the full gate when the doc ships
with a code change:

```bash
make format
make lint-md
make lint
```

`make format` is Prettier and MUST run before any lint target. `make lint` aggregates
`lint-next` (ESLint), `lint-tsc` (TypeScript), `lint-md` (markdownlint), and `lint-deps`
(dependency-cruiser). If the doc documents a code change, also run the test suites the
change touches (`make test-unit-client`, `make test-unit-server`, `make test-e2e`,
`make test-visual`); prefix unit runs with `CI=1` to run locally without Docker.

## Align With AGENTS.md

`AGENTS.md` is the root contract: the mandatory test-scenario coverage policy,
behavior-first assertions (`getByRole`/`getByLabelText`/`getByText`, localized `t()`),
and the Definition of Done. Documentation must reinforce that contract, never contradict
or restate it — link to it instead.

## Planning Skills Are Separate

BMAD/bmalph planning lives in `.claude/commands/` (slash commands like `/create-prd`,
`/architect`, `/dev`) and `_bmad/`, which are gitignored and local-only. Reference them
when relevant, but do NOT duplicate them into `.claude/skills/`. Implementation skills
here stay separate from the planning surface.

## Line-Length Disclosure

Before presenting changes, scan changed text files for lines longer than 100 characters.
Report each `path:line` with its measured length. Treat it as disclosure, not failure,
unless a gate (`make lint-md` for scanned docs, `make format` for skill docs) actually
fails — then fix it.

## Supporting Files

- [reference/doc-templates.md](reference/doc-templates.md) — feature README and skill
  doc skeletons.
- [reference/verification-checklist.md](reference/verification-checklist.md) — checks to
  clear before committing docs.
- [examples/README.md](examples/README.md) — worked examples for both doc types.

## Related Guides

Confirm the active task against [../AI-AGENT-GUIDE.md](../AI-AGENT-GUIDE.md) and
[../SKILL-DECISION-GUIDE.md](../SKILL-DECISION-GUIDE.md) so every relevant skill is
consulted before you start writing.
