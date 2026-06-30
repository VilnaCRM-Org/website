# Documentation Sync — Quality Standards

## Update docs when changing

- A Makefile target's behavior or its `## ...` help text.
- Test commands, Jest environments, or mock infrastructure (Mockoon, the Apollo
  Server mock).
- Tooling or CI gates: ESLint, TypeScript (`tsc`), markdownlint,
  dependency-cruiser, or Stryker.
- `src/features` folder conventions, a feature's `index.ts` barrel, or a
  shared-layer boundary.
- A public component, hook, GraphQL schema, or Apollo resolver API.

## Quality rules

- Keep commands copy-pasteable as make targets (e.g. `make test-unit-client`),
  not raw `pnpm`/`eslint` invocations.
- Name the smallest useful verification command for the change.
- Keep examples on real repo paths (`src/features/<feature>`,
  `src/test/testing-library/`, `src/test/apollo-server/`).
- Keep website docs website-specific — no CRM backend, DI, or RTK Query
  workflows.
- For markdownlint-scanned docs (`README.md`, `CONTRIBUTING.md`, `agents.md`,
  `cursor-project-guide.md`) keep fenced blocks `bash`-only and lines at or
  under 100 characters. markdownlint's `**/*.md` glob skips dot-directories, so
  `.claude/skills/**` is not scanned, and `CLAUDE.md` is explicitly ignored in the
  Makefile — but both are still Prettier-formatted, so keep their snippets valid and clean.
