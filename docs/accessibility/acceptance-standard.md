# Accessibility Acceptance Standard

This is the binding accessibility contract for the VilnaCRM website. It defines the
conformance target, what is automatically enforced, what a human still has to check, and
how an exception is accepted. It was introduced by issue #317.

If you are adding or changing a page or a component, the short version is: run
`make test-a11y`, fix what it reports, and read the [Definition of a11y-done](#definition-of-a11y-done)
before opening the PR.

## Conformance target

The target is **WCAG 2.1 Level AA**.

That is the level enterprise procurement and public-sector tenders normally ask for, and it
is the level EN 301 549 maps to for web content. AAA criteria are out of scope, and so is
WCAG 2.2 — raising the target is a deliberate change to this document, not a silent edit to
a tag list.

## In-scope rule set

The gate runs [axe-core](https://github.com/dequelabs/axe-core) restricted to the tags that
make up WCAG 2.1 AA. The list lives in exactly one place, `src/test/a11y/axe-config.ts`, and
no spec may re-declare it:

| axe tag    | Meaning                    |
| ---------- | -------------------------- |
| `wcag2a`   | WCAG 2.0 Level A criteria  |
| `wcag2aa`  | WCAG 2.0 Level AA criteria |
| `wcag21a`  | WCAG 2.1 Level A additions |
| `wcag21aa` | WCAG 2.1 AA additions      |

Deliberately excluded:

- `best-practice` — axe's own advisory heuristics. They are useful review material but they
  are not success criteria, so failing a build on them would block merges for reasons that
  have nothing to do with the stated target.
- `wcag2aaa`, `wcag22aa` — above the target.
- `experimental`, `deprecated` — axe suppresses these by default via `tagExclude`.

That last exclusion has a catch worth knowing about. In axe-core 4.12.1, five rules carry a
WCAG 2.1 AA tag and are flagged `experimental`, so a plain tag-based run silently never
executes them — including `label-content-name-mismatch`, which is the **only** rule in
axe-core tagged `wcag21a`.
Without an override, that whole tag matches nothing. `FORCED_RULES` in
`src/test/a11y/axe-config.ts` re-enables them, and a unit test asserts the list stays correct
against the installed axe-core:

- `label-content-name-mismatch` — SC 2.5.3, Label in Name.
- `td-has-header` — SC 1.3.1, on data tables.
- `table-fake-caption` — SC 1.3.1.

## The two enforced layers

Both layers run on every pull request and both must pass.

### Component level

`jest-axe` runs against rendered React in jsdom, through the existing client Jest suite.

- Helper: `expectNoA11yViolations(container)` in `src/test/a11y/expect-no-a11y-violations.ts`.
- Suite: `src/test/testing-library/A11yComponents.test.tsx`, plus inline assertions in the
  component specs themselves.
- Command: `make test-a11y-components`.

**This layer covers semantics only** — roles, accessible names, states, relationships and
labelling. jsdom has no layout or paint engine, so `color-contrast` and `link-in-text-block`
cannot produce a trustworthy result there and are disabled explicitly. A green component test
is necessary, never sufficient: every criterion that depends on how the page actually renders
belongs to the route layer.

### Route level

`@axe-core/playwright` runs against every registered route in Chromium, Firefox and WebKit,
against the real production build.

- Helper: `scanRoute(page, route)` in `src/test/a11y/scan-route.ts`.
- Registry: `src/test/a11y/routes.ts` — one entry per page under `pages/`. A unit test derives
  the route list from the filesystem and fails if the registry drifts, so a new page cannot
  quietly escape the scan.
- Keyboard: `expectKeyboardOperable(page)` in `src/test/a11y/keyboard.ts` walks the route with
  Tab alone and asserts focus keeps moving (SC 2.1.2, keyboard traps) and follows DOM order
  (SC 2.4.3). axe ships no keyboard-trap rule at all, so this is coverage the scan structurally
  cannot provide.
- Command: `make test-a11y-routes`.

### How this relates to the other gates

| Gate                          | What it actually asserts                             |
| ----------------------------- | ---------------------------------------------------- |
| `jsx-a11y` (`make lint-next`) | Static JSX heuristics; no runtime DOM                |
| Lighthouse a11y category      | A weighted score, on two URLs, no per-rule pass/fail |
| `make test-a11y`              | Per rule, per component and per route, pass/fail     |

The first two stay exactly as they are. This standard adds the deterministic layer they lack;
it does not replace them, and neither may be weakened to "avoid duplication".

## Running it

```bash
make test-a11y              # both gates
make test-a11y-components   # jest-axe, jsdom, fast
make test-a11y-routes       # axe + keyboard in real browsers (boots the prod stack)
```

CI runs the same target from `.github/workflows/a11y-testing.yml` as a check of its own,
separate from `static testing` and `performance testing`. The route scans also run in the
prod-side phase via `make ci-test-a11y`. Whether a check actually blocks a merge is a
repository ruleset setting rather than something a workflow can declare — `main` has no
required checks configured yet, which is tracked separately.

## Definition of a11y-done

A page or component is done when all of the following are true.

1. `make test-a11y` passes with no new entry added to the exception allowlist.
2. Every interactive control is reachable and operable with the keyboard alone, and the focus
   position is visible at every step.
3. Every control has an accessible name that matches its visible label.
4. Form fields are programmatically associated with their labels, and error messages are
   associated with the field they describe.
5. Content structure uses real landmarks and a heading order with no skipped levels.
6. Images carry meaningful alternative text, or are marked decorative when they carry no
   information.
7. Colour is never the only way information is conveyed.
8. Any new page is added to `src/test/a11y/routes.ts`.
9. Localised strings are asserted through `t()`, not hardcoded — a missing translation on an
   `aria-*` string is an accessibility regression, not just a copy bug.

Automation cannot see items 2, 3, 7 and 9 in full. Check them by hand.

## What automation does not cover

Treat these as manual review items on any change that touches UI:

- Screen-reader output and reading order.
- Whether alternative text is _correct_, not merely present.
- Focus visibility and focus-order sanity beyond DOM order.
- Contrast in hover, focus, active, disabled and placeholder states — the route scan only ever
  sees the default state.
- Reflow, zoom and mobile viewports. The Playwright projects are desktop-only today.
- `incomplete` axe results, which mean "axe could not decide" — typically contrast over a
  gradient or an image. `scanRoute` attaches them to the Playwright report as an
  `axe-incomplete*` artifact for human review; they are not gated, because they are advisory
  by construction.

## Exception process

An exception is accepted debt, never a way to silence a new regression. It is the **only**
sanctioned form of suppression: no `eslint-disable`, no axe rule removal, no `test.skip`, no
re-introduced `if (count > 0)` guard, and no lowering of a threshold.

To add one, append an entry to `A11Y_EXCEPTIONS` in `src/test/a11y/axe-config.ts`, filling in
every field:

| Field         | Requirement                                                           |
| ------------- | --------------------------------------------------------------------- |
| `ruleId`      | The axe rule id, e.g. `color-contrast`                                |
| `scope`       | CSS selector the waiver is limited to, or `*` for every node          |
| `layer`       | `component` or `route`                                                |
| `routes`      | Route paths covered — required for `route`, forbidden for `component` |
| `reason`      | Why it is accepted rather than fixed                                  |
| `trackingUrl` | GitHub issue on this repository tracking the burn-down                |

`findInvalidExceptions` enforces every field, and `src/test/unit/a11y/axe-config.test.ts`
asserts it over the committed list — so a malformed entry fails CI rather than widening the
gate. Two bounding rules matter:

- Filtering is **per node**, never per rule. An exception scoped to one selector cannot hide
  the same rule failing at a different selector.
- A `*` scope is only accepted on a `route` exception that names its routes. A blanket waiver
  can never silently cover a page nobody reviewed it against.

Reviewers should treat any new exception as a design question, not a test question, and every
exception must be deleted in the same change that fixes its underlying defect.

### Current exceptions

| Rule             | Scope      | Routes                          | Tracking |
| ---------------- | ---------- | ------------------------------- | -------- |
| `color-contrast` | `*`        | `/`, `/swagger`, `/en/docs/api` | #423     |
| `select-name`    | `#servers` | `/swagger`                      | #424     |

Both were surfaced by this gate on the day it landed. The contrast failures come from shared
brand tokens, and the unnamed select is rendered by third-party `swagger-ui-react`; both are
tracked for burn-down rather than waived quietly.
