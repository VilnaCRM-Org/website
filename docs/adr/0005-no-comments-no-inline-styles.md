# ADR 0005: Production source carries no comments and no inline styles

- **Status:** Accepted
- **Date:** 2026-09-11
- **Deciders:** website maintainers
- **Related:** PR #467 review, issue #339, ADR 0004

## Context

Two habits crept into `src/` and `pages/` faster than review could hold them back.

The first was rationale written as comments. By the time of PR #467 the production tree
carried roughly seven hundred comment lines across fifty files — JSDoc blocks retelling
the issue that introduced a module, trailing notes explaining a branch, JSX comments
describing a tag that was deliberately _not_ rendered. Each one was defensible on its own.
Together they were a second, unchecked copy of the design: nothing compiles a comment,
nothing tests it, and the one in `pages/_document.tsx` that the review flagged described
code that no longer existed on the line it sat above. A reader could not tell which
comments were still true, and a reviewer could not tell which had gone stale.

The second was styling declared in render. The house convention has always been a sibling
`styles.ts` referenced as `sx={styles.name}` — it is what the `frontend-component-
development` skill says, and what most components do — but nothing enforced it, so
`sx={{ mt: 2 }}`, `sx={[styles.a, { alignItems: 'center' }]}` and
`sx={{ ...styles.button, marginTop: '0.5rem' }}` accumulated in twenty files. One of them
mutated the shared style object with `Object.assign` on every render.

The review asked for both to be fixed and, more importantly, for a **deterministic**
guard against their return. "Unnecessary" is not something a linter can judge, so the
only deterministic form of "no unnecessary comments" is "no comments".

## Decision

Two ESLint gates in `eslint.config.mjs`, both scoped to `src/**` and `pages/**` and
both exempting specs (`src/test/**`, `tests/**`) and stories, both run by `make lint-next`
on every PR and proved by `src/test/unit/lint/production-source-gates.test.ts` against
the real binary and the committed config.

- **`vilnacrm/no-comments`.** A rule defined inline in the config (tools that copy the
  config into a cache directory cannot resolve a relative import from it) reports every
  comment token the parser produces — line, block, JSDoc and JSX alike — so there is no
  spelling that slips past it. There is no allow-list and no auto-fixer: a fixer would
  turn "relocate the rationale" into "delete it".
- **No object literal inside `sx` or `style`.** Two `no-restricted-syntax` selectors,
  `JSXAttribute[name.name='sx'] ObjectExpression` and its `style` twin, sit in the same
  block as the `process.env` guard from #328. The descendant selector catches the literal
  wherever it hides — bare, spread, inside an array, inside a theme callback. A style
  that depends on a runtime value is a **function** in `styles.ts`
  (`sx={styles.vector(src)}`), not a literal in render.

Where the rationale goes instead, in order of preference:

1. **An ADR** (`docs/adr/`) for a decision that would be expensive to reverse.
2. **A design note under `docs/`** for a mechanism a future reader would otherwise
   reconstruct from a diff — `docs/seo-surface.md`, `docs/offline-shell.md`,
   `docs/sign-up-hardening.md`, and the sections of `docs/extending-the-website.md` are
   where the comments this decision removed now live.
3. **The spec that pins the behaviour.** A test file may carry comments, and a comment
   next to the assertion that would fail if the reasoning stopped holding is the one
   kind that cannot go stale unnoticed.
4. **The commit message**, for the why of a single change.

A feature README (`src/features/<feature>/README.md`) records component-level notes that
belong to that feature alone.

Pages follow from this: a page under `pages/` is a composition of `<Seo>` and a feature
component, because `pages/` cannot hold a non-route module and so cannot hold a
`styles.ts`. PR #467 moved the 404, offline, Swagger-loading and API-docs bodies into
`src/features/not-found`, `src/features/offline`, `src/features/swagger` and
`src/features/documentation` for exactly that reason.

## Consequences

### What this buys

One source of truth for design rationale, held to the same review as any other document
and never silently contradicted by the code beside it. A style convention that is no
longer a matter of reviewer attention. Both gates fail closed and cannot be satisfied by
a suppression comment, because `eslint-comments/no-use` already bans those — and a
disable directive is itself a comment the first gate would report.

### What this costs

- **Rationale is further from the code.** A reader of `src/config/env.ts` no longer sees,
  on the line, why the loopback regex is written as one pattern; they have to know that
  `docs/extending-the-website.md` holds it. The mitigation is the ordered list above and
  the README pointers, not a loosening of the rule.
- **No JSDoc on exported functions**, so editors show no hover documentation for this
  repository's own modules. Types carry the contract; prose does not.
- **A blunt instrument.** The rule cannot distinguish a stale comment from a useful one,
  so it removes the option of a useful one. That is the trade the review asked for: a
  gate that needs judgement to apply is not a gate.
- **Pages are one hop deeper.** Every page body now lives in a feature, which is more
  files for a stub such as `/en/docs/api`. It is also what `docs/extending-the-website.md`
  said a page should look like before this decision.
- **Migration noise.** Fifty files changed in one PR to land the first gate green. That
  is a one-time cost; a ratchet with a fifty-file allow-list would have paid it forever.
