# Accessibility Acceptance Standard

This is the binding accessibility contract for the VilnaCRM website. It defines the
conformance target, what is automatically enforced, what a human still has to check, and
how an exception is accepted. It was introduced by issue #317.

If you are adding or changing a page or a component, the short version is: run
`make test-a11y`, fix what it reports, and read the [Definition of a11y-done](#definition-of-a11y-done)
before opening the PR. If your change adds or alters an interaction state — a dialog, a drawer,
an error state, an expanded panel — `make test-e2e` carries a scan for those too.

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
`src/test/a11y/axe-config.ts` re-enables **three** of those five, and a unit test asserts the
list stays correct against the installed axe-core:

- `label-content-name-mismatch` — SC 2.5.3, Label in Name.
- `td-has-header` — SC 1.3.1, on data tables.
- `table-fake-caption` — SC 1.3.1.

The remaining two are left disabled on purpose, so the gate does not claim them:
`p-as-heading` reports on subtitle typography this site uses deliberately, and
`css-orientation-lock` parses every stylesheet and returns non-deterministic `incomplete`
results. Both reasons are recorded next to `FORCED_RULES` itself.

## The three enforced layers

Every layer runs on every pull request and every one must pass.

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
belongs to the route layer. `link-in-text-block` is enforced there for real; `color-contrast`
is not, because it is waived on every registered route until #423 lands — see
[Current exceptions](#current-exceptions).

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
  cannot provide. The sweep is capped at the first 120 tab positions of a route
  (`MAX_SWEEP_STEPS`), so on a longer route those two criteria are asserted over that prefix
  rather than the whole page.
- Command: `make test-a11y-routes`.

### Interaction states

Introduced by issue #369. The two layers above cannot see composed, conditional DOM: static
lint reads one component's JSX, and the route scan only ever sees a page at initial load. A
validation message that is never associated with its field, a drawer that hides the page from
assistive technology while leaving it focusable, an expanded operation whose control has no
accessible name — each of those ships with both layers green.

So axe also runs mid-journey, inside the Playwright e2e suite:

- Helper: `scanInteractionState(page, state)` in `src/test/a11y/scan-interaction-state.ts`.
- Registry: `src/test/a11y/interaction-states.ts` — one entry per scanned state.
- Where it runs: as an added assertion inside the **existing** e2e journeys that already drive
  these states, so there is no new job, no new journey and no separate advisory leg. It runs in
  the existing `--shard` matrix in Chromium, Firefox and WebKit.
- Command: `make test-e2e` (or `make test-e2e-shard`).

| State                                          | Journey                                   |
| ---------------------------------------------- | ----------------------------------------- |
| Registration form, inline validation errors    | `register-form/validation.spec.ts`        |
| Registration form, submit error notification   | `register-form/submit-error.spec.ts`      |
| Mobile navigation drawer open (450px viewport) | `drawer-is-visible.spec.ts`               |
| Swagger operation expanded                     | `swagger/swagger-ui-interactions.spec.ts` |
| Swagger authorize dialog open                  | `swagger/swagger-ui-interactions.spec.ts` |

Two deliberate differences from the route layer:

- **Only serious and critical impacts are gated.** These scans live inside journeys whose
  primary job is behavioural, over DOM composed at runtime, where a moderate or minor advisory
  finding can trip for reasons that have nothing to do with the interaction under test. Keeping
  the gate at serious/critical is what makes an always-on scan inside a shared journey
  acceptable. Moderate and minor findings are attached to the Playwright report as
  `axe-advisory-*` for review, and a violation axe reports _without_ an impact fails closed.
  The route layer still gates every impact at initial load, so nothing was narrowed — this
  layer only adds.
- **The exception context is the state's route.** A waiver already reviewed for `/` applies to
  every state on `/`, and to no other page. Interaction states do not get their own waiver
  namespace, so an accepted exception cannot be widened by adding a state.

`src/test/unit/a11y/interaction-states.test.ts` reads the e2e specs and fails when a
registered state stops being scanned, so a scan cannot be deleted while this document, the
registry and the CI summary all still claim the state is covered.

### How this relates to the other gates

| Gate                          | What it actually asserts                             |
| ----------------------------- | ---------------------------------------------------- |
| `jsx-a11y` (`make lint-next`) | Static JSX heuristics; no runtime DOM                |
| Lighthouse a11y category      | A weighted score, on two URLs, no per-rule pass/fail |
| `make test-a11y`              | Per rule, per component and per route, pass/fail     |
| `make test-e2e`               | Per rule at runtime interaction states, pass/fail    |

The first two stay exactly as they are. This standard adds the deterministic layers they lack;
it does not replace them, and neither may be weakened to "avoid duplication".

## Running it

```bash
make test-a11y              # the component and route gates
make test-a11y-components   # jest-axe, jsdom, fast
make test-a11y-routes       # axe + keyboard in real browsers (boots the prod stack)
make test-e2e               # includes the interaction-state scans
```

The route leg reuses the running production stack, exactly like `make test-e2e` and
`make test-visual`. If you changed product code since the image was last built, run
`make start-prod-clean` first so the scan measures your checkout rather than a stale
bundle. CI always builds from scratch, so this only affects local runs.

CI runs the same target from `.github/workflows/a11y-testing.yml` as a check of its own,
separate from `static testing` and `performance testing`. The route scans also run in the
prod-side phase via `make ci-test-a11y`. The interaction-state scans need no workflow of their
own: they are assertions inside the e2e specs, so they run in every `e2e shard N/4` job and a
violation fails that job. Whether a check actually blocks a merge is a repository ruleset
setting rather than something a workflow can declare — `main` has no required checks configured
yet, which is tracked separately.

## Definition of a11y-done

A page or component is done when all of the following are true.

1. `make test-a11y` passes with no new entry added to the exception allowlist, and so does
   `make test-e2e` — which carries the interaction-state scans.
2. Every interactive control is reachable and operable with the keyboard alone, and the focus
   position is visible at every step.
3. Every control has an accessible name that matches its visible label.
4. Form fields are programmatically associated with their labels, and error messages are
   associated with the field they describe.
5. Content structure uses real landmarks and a heading order with no skipped levels.
6. Images carry meaningful alternative text, or are marked decorative when they carry no
   information.
7. Colour is never the only way information is conveyed.
8. Any new page is added to `src/test/a11y/routes.ts`, and any new interaction state that
   composes or replaces DOM — a dialog, a drawer, an error state, an expanded panel — is added
   to `src/test/a11y/interaction-states.ts` and scanned from the journey that drives it.
9. Localised strings are asserted through `t()`, not hardcoded — a missing translation on an
   `aria-*` string is an accessibility regression, not just a copy bug.

Automation cannot see items 2, 3, 7 and 9 in full. Check them by hand.

## What automation does not cover

Treat these as manual review items on any change that touches UI:

- Screen-reader output and reading order.
- Whether alternative text is _correct_, not merely present.
- Focus visibility and focus-order sanity beyond DOM order.
- Contrast, in every state. Default-state contrast is waived on all three registered routes
  until #423 lands, and hover, focus, active, disabled and placeholder contrast is never
  scanned at all — the route scan sees a page at rest, and the interaction-state scans see only
  the states they are registered for.
- Keyboard traps and focus-order defects past the first 120 tab positions of a route, which is
  where the Tab sweep stops.
- Reflow and zoom. The Playwright projects are desktop-only; the only scan at a mobile viewport
  is the open navigation drawer, which resizes the page itself.
- Moderate and minor findings at an interaction state. They are attached to the Playwright
  report as `axe-advisory-*` rather than gated — see the interaction-state layer above for why
  — so reading those attachments is a review task, not an automated one.
- Anything axe tags `best-practice` rather than as a WCAG criterion. The tag filter is what
  keeps the gate honest, but it also means real APG requirements are invisible to it: an open
  dialog with no accessible name is `aria-dialog-name`, which is `best-practice`-tagged, so no
  layer reports it (#435). Naming a dialog, a region or a landmark stays a review item.
- `incomplete` axe results, which mean "axe could not decide" — typically contrast over a
  gradient or an image. Every scan attaches them to the Playwright report as an
  `axe-incomplete-*` artifact for human review; they are not gated, because they are advisory
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
- A `route` exception also covers the interaction states reached on that route. There is no
  per-state waiver namespace, so adding a state can never widen an accepted exception, and a
  waiver reviewed for one page still never reaches another.

Reviewers should treat any new exception as a design question, not a test question, and every
exception must be deleted in the same change that fixes its underlying defect.

### Current exceptions

| Rule and scope                                        | Routes                | Tracking |
| ----------------------------------------------------- | --------------------- | -------- |
| `color-contrast`, every node                          | `/`, `/swagger`, docs | #423     |
| `select-name` on `#servers`                           | `/swagger`            | #424     |
| `button-name` on `.close-modal`                       | `/swagger`            | #433     |
| `label-content-name-mismatch` on the authorize submit | `/swagger`            | #433     |
| `td-has-header` on `#get_api_users_responses`         | `/swagger`            | #433     |

The exact selectors are in `A11Y_EXCEPTIONS`; "docs" above is `/en/docs/api`, and the authorize
submit is matched as `button[aria-label="Apply given OAuth2 credentials"]`.

Every one was surfaced by this gate's own output. The contrast failures come from shared brand
tokens (#423). The rest are all markup rendered by third-party `swagger-ui-react`, where there
is no local element to fix: an unnamed close button and an `aria-label` that replaces rather
than includes the visible "Authorize" text in the authorize dialog, a header row built from
`<td class="col_header">` instead of `<th>` in the responses table, and the unlabelled servers
select (#424, #433). All are tracked for burn-down rather than waived quietly, and the fix
belongs upstream — not in a DOM patch layered over the widget.

Be explicit about what the first row costs: **SC 1.4.3, Contrast (Minimum), is currently
enforced at neither layer.** The component layer disables `color-contrast` because jsdom has no
paint engine, and the route layer waives it with a `*` scope on every route in the registry
until #423 lands. The WCAG 2.1 AA target above therefore excludes contrast today. The
Lighthouse accessibility score does not fill the gap — it is a weighted average over two URLs
with no per-rule pass/fail, and its budgets were baselined with these failures already present.
Closing #423 is what restores the criterion; widening the waiver, or adding a route to it, is
not.

Interaction-state scanning also found one violation in **our own** code, which was fixed rather
than waived: the mobile drawer passed `role="menu"` to MUI's `Drawer`, which forwards it to the
modal root holding the backdrop and the paper, so that root failed `aria-required-children` at
critical impact. A temporary Drawer is already a dialog (MUI sets `role="dialog"` and
`aria-modal` on the paper) and its links are a real `<nav>` list, so the override was simply
wrong.
