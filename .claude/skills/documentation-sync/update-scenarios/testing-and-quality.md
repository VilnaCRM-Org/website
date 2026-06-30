# Testing and Quality

## Testing workflow changes

Update docs that mention:

- Jest environments — `TEST_ENV=client` (jsdom) and `TEST_ENV=server` (node) —
  and `make test-unit-client` / `make test-unit-server` / `make test-unit-all`.
- Playwright, Mockoon, or the Apollo Server mock and `make test-e2e`.
- Visual snapshot rules: `make test-visual` and the regenerate path
  `make test-visual-update`.
- Specialized suites: `make test-mutation` (Stryker),
  `make test-memory-leak` (Memlab), `make load-tests` / `make test-load` (K6),
  and `make lighthouse-desktop` / `make lighthouse-mobile`.

## Quality workflow changes

Update docs that mention:

- `make format` (Prettier).
- `make lint` and its parts: `lint-next` (ESLint), `lint-tsc` (TypeScript),
  `lint-md` (markdownlint), and `lint-deps` (dependency-cruiser).
- The complexity/metrics gate introduced by issue #224 (rust-code-analysis), not
  yet on `main`, and its policy file `config/metrics-policy.json`. When the gate
  or its thresholds change, sync the docs that describe it and point at the policy
  file as the source of truth instead of restating thresholds in prose.

Finish with `make format`, then `make lint-md`, then `make lint` for code
changes:

```bash
make format
make lint-md
make lint
```
