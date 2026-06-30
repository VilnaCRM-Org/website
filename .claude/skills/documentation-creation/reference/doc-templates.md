# Documentation Templates

Copy a skeleton, then replace every placeholder with real repo facts. The skeletons use
`text` fences so this skill doc stays prettier-clean; in a real feature README the
verification block must be a ` ```bash ` fence (MD040 allows only `bash` in scanned docs).

## Feature README

Lives at `src/features/<feature>/README.md` (kebab-case feature name). A feature root may
only contain the index barrel and the allowed folders, so the Key Files list must point
at real ones (`index.ts`, `components/`, `api/`, `hooks/`, `i18n/en.json`,
`i18n/uk.json`).

```text
# Feature Name

## Purpose

The user-facing workflow this feature supports.

## Key Files

- `src/features/<feature>/index.ts` — public-API barrel (import the feature via this)
- `src/features/<feature>/components/` — UI for the workflow
- `src/features/<feature>/api/` — Apollo Client queries and mutations
- `src/features/<feature>/i18n/en.json` and `i18n/uk.json` — translations (assert via t())

## Conventions

- kebab-case directory and file names.
- Import this feature through its index barrel, never a deep path.
- Forms use react-hook-form; user-facing strings come from i18next t().

## Verification

(in the real README, fence the block below as bash)

make format
make test-unit-client
make lint
```

## Skill Doc

Lives at `.claude/skills/<skill>/SKILL.md`. Frontmatter is required; depth goes into
`reference/` and `examples/`. Here `ts`/`tsx`/`json` fences are allowed but are
prettier-formatted, so keep any code valid and clean.

```text
---
name: <skill-name-kebab-case>
description: Use when <concrete trigger terms tied to website paths and commands>.
---

# Topic

## When To Use

Specific triggers — paths, file types, or commands that should invoke this skill.

## Pattern

Short, actionable, website-grounded guidance.

## Verification

The make targets or checks that prove the workflow.
```

## i18n Snippet (skill-doc class only)

A `json` fence is fine inside a skill doc because markdownlint does not scan it; keep it
prettier-clean. Do NOT put a `json` fence in a scanned feature README — use prose or a
`bash` example there instead.

```json
{
  "title": "Sign up",
  "submit": "Create account"
}
```
