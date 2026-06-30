# Validation sequences

Copy-paste command blocks for the common website change kinds. Each follows the core
order: `make format`, then the focused suite(s), then `make lint`. Prefix unit suites
with `CI=1` to run them locally without Docker.

## React component, hook, or client logic

For changes under `src/features/*/components`, `src/components`, `src/hooks`, or specs in
`src/test/testing-library` and `src/test/unit`:

```bash
make format
CI=1 make test-unit-client
make lint
```

If the change alters rendered UI or styling, add a visual pass; if it changes a
user-facing flow, add an e2e pass:

```bash
make test-visual   # rendered UI / styling
make test-e2e      # user-facing flow (Playwright + Mockoon)
```

## Apollo / GraphQL server-mock logic

For changes that touch server-side resolvers or specs under `src/test/apollo-server`:

```bash
make format
CI=1 make test-unit-server
make lint
```

When a change spans both client and server layers, run both unit suites at once:

```bash
make format
CI=1 make test-unit-all
make lint
```

## Imports, public-API barrels, or feature boundaries

For new cross-feature imports, changed `index.ts` barrels, or moved shared code:

```bash
make format
make lint-deps   # dependency-cruiser boundary check (also part of make lint)
make lint
```

## i18n string changes

For edits to `src/features/*/i18n/{en,uk}.json` or the strings that consume them:

```bash
make format
CI=1 make test-unit-client   # assert t() output, both locales
make lint
```

Add `make test-e2e` or `make test-visual` when the translated string is user-visible.

## Documentation and Markdown

For Markdown-only changes (including scanned top-level guides):

```bash
make format
make lint-md
make lint
```

## Makefile or CI shell scripts

For changes to the Makefile or `scripts/ci/*`:

```bash
make format
make test-bats
make lint
```

## Deliberate visual baseline refresh

Only after confirming the pixel diff is an intended UI change:

```bash
make test-visual          # observe the diff first
make test-visual-update   # regenerate baselines in the Docker Playwright container
# review the updated snapshots in the diff, then commit
```

## Final pre-PR sweep

Run the grouped CI phases (or the full flow) before opening the PR:

```bash
make ci-lint   # parallel ESLint + TypeScript + markdownlint
make ci-test   # parallel client unit + server unit + integration
make lint      # full gate, including dependency-cruiser (lint-deps)
```
