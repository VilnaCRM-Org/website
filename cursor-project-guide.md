# Cursor Project Guide

This is the orientation guide for Cursor, Claude Code, and any other AI agent working in the
VilnaCRM `website` repository. It explains what the project is, where code lives, how to run
every check through `make`, and the conventions a change must honor. Read `agents.md` first for
the mandatory test-coverage contract; this guide assumes it and points back to it.

## Project overview

`website` is the VilnaCRM marketing site and landing, built on Next.js 16 (pages router) and
React 19 with TypeScript 6. The UI uses MUI 9 with Emotion; data is fetched with Apollo Client 4
against a local Apollo Server 5 GraphQL mock; forms use react-hook-form; copy is localized with
i18next and react-i18next; components are documented in Storybook 10. The package manager is
`pnpm@10.6.5` and Node is `>=20`. The folder layout is adapted from bulletproof-react, and every
command runs through a Makefile target from the repository root.

There is no Redux, no Zustand, and no dependency-injection container, and there is no
`src/modules/` layer. State is local or served by Apollo's cache, and code is organized by
feature under `src/features/`. Do not document or reach for any of those absent tools.

## Where the code lives

- `pages/` holds the Next.js pages-router entrypoints (`_app.tsx`, `_document.tsx`,
  `index.tsx`, `swagger.tsx`). Pages are the composition layer that wires features into routes.
- `src/features/<feature>/` holds feature code. Allowed subfolders are `api`, `assets`,
  `components`, `constants`, `helpers`, `hooks`, `i18n`, `routes`, `types`, and `utils`, plus
  the `index.ts` public-API barrel. Present features: `documentation`, `example`, `landing`,
  `registration`, `swagger`.
- `src/components/` holds shared, feature-agnostic UI primitives that follow the `ui-*` prefix
  (for example `ui-button`).
- Shared foundational layers are `src/hooks`, `src/lib`, `src/providers`, `src/shared`,
  `src/stores`, `src/utils`, `src/config`, `src/types`, `src/assets`, and `src/routes`.
- `src/test/` holds every spec, split by suite (see Testing strategy below).

Import a feature only through its `index.ts` barrel, never through a deep internal path. Use the
`@/*` alias (mapped to `./src/*` in `tsconfig.json`) instead of long relative paths.

## Command surface

Run everything through `make`; the targets are the single source of truth and the same ones CI
runs. The aggregate gate is `make lint`, which runs ESLint, TypeScript, markdownlint, and
dependency-cruiser in sequence.

```bash
make format     # Prettier formatting; run before lint
make lint       # Full gate: lint-next + lint-tsc + lint-md + lint-deps
make lint-next  # ESLint only
make lint-tsc   # TypeScript type-check only
make lint-md    # markdownlint only
make lint-deps  # dependency-cruiser architecture/import boundaries
make build      # Production build
```

## Development setup

Requirements: Node `>=20`, `pnpm@10.6.5`, and Docker for the containerized dev and test stacks.

```bash
make check-node-version   # Verify the Node version
make install              # Install dependencies (frozen lockfile)
make husky                # One-time Git hooks setup
make start                # Start the dev server
```

## Running commands without Docker

Prefix unit and lint commands with `CI=1` to run them locally without the Docker stack. `CI=1`
makes the Makefile call the local `pnpm` binaries directly instead of execing into a container.

```bash
CI=1 make test-unit-all                 # Both unit suites, no Docker
CI=1 make lint-next                      # ESLint, no Docker
CI=1 TEST_ENV=client pnpm exec jest \
  src/test/unit/email-validation.test.ts # One client spec
```

`TEST_ENV` selects the Jest environment: `client` (jsdom) or `server` (node). Pick the value
that matches the spec you are running.

## Testing strategy

Specs live under `src/test/`. Client unit specs (`testing-library/**/*.test.tsx` and
`unit/**/*.test.ts`) run on Jest with React Testing Library in jsdom (`TEST_ENV=client`). Server
unit specs (`apollo-server/**/*.test.ts`) run on Jest in node (`TEST_ENV=server`). E2E specs
(`e2e/**/*.spec.ts`) and visual specs (`visual/**/*.spec.ts`) run on Playwright across chromium,
firefox, and webkit; visual snapshots live in adjacent `*-snapshots/` folders. Load specs live
in `load/` (K6) and memory specs in `memory-leak/` (Memlab). Faker builders are seeded for
reproducibility.

```bash
make test-unit-all       # Client + server unit suites
make test-unit-client    # Client unit suite (jsdom, TEST_ENV=client)
make test-unit-server    # Server unit suite (node, TEST_ENV=server)
make test-e2e            # E2E flows (Playwright + Mockoon API mock)
make test-e2e-ui         # E2E in Playwright UI mode
make test-visual         # Visual regression
make test-visual-update  # Refresh visual snapshots after an intended UI change
```

Specialized suites for changes that touch their concern:

```bash
make test-mutation       # Stryker mutation testing
make test-bats           # Bats coverage for Makefile and CI shell flows
make test-memory-leak    # Memlab leak detection
make test-load           # K6 homepage load test (alias of load-tests)
make test-load-swagger   # K6 Swagger-page load test
make lighthouse-desktop  # Lighthouse desktop audit
make lighthouse-mobile   # Lighthouse mobile audit
```

CI phase aliases (`make ci-lint`, `make ci-test`, and the rest) mirror the pipeline stages so
you can run the same grouped phases locally.

## Code review workflow

Use `make pr-comments` to retrieve unresolved review comments and address them systematically.
It auto-detects the PR from the current branch, or you can pass `PR` and `FORMAT` explicitly.
`FORMAT` accepts `text` (default), `json`, or `markdown`, and the output includes file paths,
line numbers, authors, timestamps, and GitHub URLs.

```bash
make pr-comments                  # Auto-detect PR from the current branch
make pr-comments PR=215           # Target a specific PR
make pr-comments FORMAT=markdown  # Render as Markdown
```

Work through the comments in priority order: committable suggestions first, then refactor
instructions, then questions, then general observations. After each comment or related group,
re-run the gate so nothing regresses.

```bash
make format        # Re-apply formatting
make lint          # Full gate
make test-unit-all # Re-run the affected unit suites
```

When you address a comment, reply with the commit that resolves it; when you cannot, explain the
constraint and propose an alternative.

## Common tasks

### Adding a feature

```bash
mkdir -p src/features/my-feature/{api,components,helpers,hooks,i18n,types,constants}
touch src/features/my-feature/i18n/en.json
touch src/features/my-feature/i18n/uk.json
touch src/features/my-feature/index.ts
```

The feature root may contain only the allowed subfolders and the `index.ts` barrel; stray files
or extra folders fail `make lint-deps`. Co-locate form-validation logic in the feature's
`helpers` or `hooks` (there is no `validations` folder in the allowed set). Export the public
surface from `index.ts`, then wire the feature into a route under `pages/`. Add specs under
`src/test/`, then verify.

```bash
make lint
make test-unit-all
```

### Adding a shared UI component

Place feature-agnostic primitives in `src/components` using the `ui-*` prefix, export them from
the `src/components/index.ts` barrel, and add a `.stories.tsx` story beside the component. Shared
UI must not import from any feature; that boundary is enforced by the `no-shared-ui-to-features`
rule in `make lint-deps`.

### Fixing lint and type errors

```bash
make format     # Auto-fix formatting first
make lint-next  # ESLint findings
make lint-tsc   # Type errors
make lint-md    # Markdown issues
make lint-deps  # Architecture/import-boundary violations
make lint       # Confirm the full gate is green
```

### Updating dependencies

```bash
make update          # Update to latest allowed versions and refresh the lockfile
make test-unit-all   # Confirm nothing broke
make build           # Confirm the production build still succeeds
```

### Working with Storybook

```bash
make storybook-start  # Start Storybook
make storybook-build  # Build the static Storybook
```

## Troubleshooting

### Tests fail with module-resolution errors

Clear the Jest cache and confirm the `@/*` alias resolves the same way in `tsconfig.json` and
`jest.config.ts`. If a feature import fails, check that the symbol is exported from the feature's
`index.ts` barrel rather than imported from a deep path.

```bash
CI=1 pnpm exec jest --clearCache
```

### Dev container will not start

Inspect the logs, tear the stack down, and bring it back up; check for a port conflict.

```bash
make logs
make down
make start
```

### E2E tests fail with API errors

E2E and visual suites run against the production container with Mockoon providing the API mock.
If requests fail, rebuild and recreate the test stack, then re-run the suite.

```bash
make start-prod-clean
make test-e2e
```

### Build fails with out of memory

Raise the Node heap and rebuild.

```bash
export NODE_OPTIONS=--max-old-space-size=4096
make build
```

## Best practices for AI-assisted work

Before writing code, search for existing patterns with grep or glob, follow the structure of a
similar feature under `src/features/`, read the related specs to learn the expected behavior,
and re-read the test-coverage contract in `agents.md`.

While writing code, import features through their `index.ts` barrel and use the `@/*` alias;
keep feature directory names kebab-case; give shared UI primitives the `ui-*` prefix; add
explicit TypeScript types (the config is strict with `noUnusedLocals` and
`noUnusedParameters`); localize every user-facing string with the i18next `t()` function and
per-feature `i18n/{en,uk}.json`; and add positive, negative, and edge-case coverage as
`agents.md` requires.

After writing code, run `make format`, then `make lint`, then the affected test suites, verify
the change in the running app, and update docs when an API or convention changes.

## Project conventions

- Code is feature-based: a feature owns its `api`, `components`, `helpers`, `hooks`, `i18n`,
  `types`, and related folders, and exposes a public surface through `index.ts`.
- Architecture boundaries are enforced by dependency-cruiser (`make lint-deps`). Key rules
  include `no-circular`, `features-import-via-public-api`, `no-cross-feature-imports`,
  `no-shared-ui-to-features`, `no-shared-layers-to-features`, `feature-allowed-folders`, and
  `src-feature-name-kebab-case`.
- Naming is kebab-case for directories and files; feature directory names are enforced kebab-case
  by `src-feature-name-kebab-case`. Shared UI primitives use the `ui-*` prefix.
- Localize all copy with the i18next `t()` function and assert localized strings in tests, never
  hardcoded English.
- Build forms with react-hook-form and fetch data with Apollo Client 4; there is no Redux or
  Zustand store to wire into.
- Prefer user-facing semantic queries in tests (`getByRole`, `getByLabelText`, `getByAltText`,
  `getByText`) over `data-testid`, per the guidance in `agents.md`.
- For a worked example of positive, negative, and empty-input coverage in one place, read
  `src/test/unit/email-validation.test.ts`.

## Git workflow

Follow Conventional Commits: a `type(scope): subject` header, an optional body, and an optional
footer. Use types `feat`, `fix`, `test`, `chore`, `docs`, `refactor`, `style`, and `perf`.

```bash
feat(landing): add newsletter signup section
fix(registration): correct email validation message
test(e2e): cover the swagger documentation flow
docs(guide): document the feature-creation workflow
```

Branch from `main` for new work; a common convention is `feature/<issue>-<short-slug>`.

## Where the agent guidance lives

- `agents.md` is the root contract: the mandatory test-coverage policy, behavior-first
  assertions, and Definition of Done. Read it before writing tests.
- `.claude/skills/` holds the implementation skills: `architecture`, `ci-workflow`,
  `code-organization`, `code-review`, `complexity-management`, `documentation-creation`,
  `documentation-sync`, `figma-design-check`, `frontend-component-development`,
  `frontend-performance-accessibility`, `frontend-quality-workflow`,
  `frontend-testing-workflow`, `load-testing`, `observability-instrumentation`,
  `quality-standards`, and `testing-workflow`. See `.claude/skills/README.md` for the index.
- `_bmad/`, `bmalph/`, and `.claude/commands/` make up the bmalph planning surface (slash
  commands such as `/bmalph`, `/create-prd`, `/architect`, `/dev`, `/sm`, `/qa`). They are
  local-only and intentionally separate from the implementation skills; reference them, do not
  duplicate them.

## Resources

- `agents.md` for the test-coverage contract.
- `Makefile` for every available command.
- `.dependency-cruiser.js` for the architecture and import boundaries.
- `eslint.config.mjs` and `tsconfig.json` for the lint and type rules.
- `README.md` for user-facing documentation.
- `.github/workflows/` for the CI pipeline definitions.

## Keeping this guide current

This guide evolves with the project. When you discover a new pattern, solve a recurring problem,
or establish a convention, update the relevant section, keep commands and paths accurate against
the live repo, and remove anything that no longer holds.
