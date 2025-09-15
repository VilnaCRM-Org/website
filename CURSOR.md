## Cursor guide for `website`

This document helps Cursor understand and work effectively with this codebase. It includes the tech stack, key scripts, common commands, environment variables, directory layout, and typical workflows.

### Stack overview
- **Framework**: Next.js 15 (React 18, TypeScript), static export (`out`) with `next-export-optimize-images`
- **UI**: MUI v6, Emotion
- **Internationalization**: `i18next`, `react-i18next`; localization generated during webpack via `scripts/localizationGenerator.js`
- **API**: Swagger UI via `swagger-ui-react`; swagger schema fetched/rewritten by `scripts/fetchSwaggerSchema.mjs` and `scripts/patchSwaggerServer.mjs`
- **GraphQL**: `@apollo/client` (client); tests for server-side behaviors under `src/test/apollo-server`
- **Error monitoring**: Sentry
- **Tooling**: Jest, Playwright, Storybook, ESLint + Prettier, Lighthouse CI, K6 (load), Memlab (memory), Stryker (mutation)
- **Runtime**: Node >= 20, PNPM; Docker + Docker Compose preferred for local dev

### Quick start
- Show all make targets:
```bash
make help
```
- Development (Docker, recommended):
```bash
make start
# App: http://localhost:3000
```
- Development (host machine, no Docker):
```bash
CI=1 make start
```
- Production preview (Docker):
```bash
make start-prod
# Waits until healthy, serves static export at NEXT_PUBLIC_PROD_PORT
```

### Common tasks
- Build production artifacts to `./out` locally (no containers):
```bash
make build-out
```
- Linting and formatting:
```bash
make lint         # ESLint + tsc + markdownlint
make format       # Prettier write
```
- Tests:
```bash
make test-unit-all      # Jest (client + server)
make test-e2e           # Playwright E2E (Docker prod)
make test-e2e-ui        # Playwright UI mode
make test-visual        # Visual regression
make test-visual-update # Update snapshots
make test-memory-leak   # Memlab
make load-tests         # K6 scenarios for app
make load-tests-swagger # K6 for Swagger page
```
- Storybook:
```bash
make storybook-start
make storybook-build
```
- Lighthouse audits:
```bash
make lighthouse-desktop
make lighthouse-mobile
```
- Docker helpers:
```bash
make ps
make logs
make new-logs
make sh
make down
make stop
```

### Environment configuration
This project relies on `.env` files (see `Makefile` includes). At minimum for local usage:
```env
# Hostnames/ports
WEBSITE_DOMAIN=localhost
DEV_PORT=3000
NEXT_PUBLIC_PROD_PORT=3001

# Public URLs (used by Playwright/Lighthouse)
NEXT_PUBLIC_PROD_HOST_API_URL=http://localhost:3001
# When running inside Docker network, baseURL is the prod service name
NEXT_PUBLIC_PROD_CONTAINER_API_URL=http://prod:3001

# Optional: CloudFront continuous deployment headers (used by tests/audits)
NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME=X-My-Header
NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE=some-value
```
Notes:
- When running commands on the host (without Docker), prefix with `CI=1`.
- `start-prod` creates/uses an external Docker network and runs a static server for `out` on port `NEXT_PUBLIC_PROD_PORT`.

### Scripts and automation
- `scripts/localizationGenerator.js`: Generates `pages/i18n/localization.json` during webpack builds (`next.config.js`).
- `scripts/fetchSwaggerSchema.mjs`: Downloads swagger schema during dev and build.
- `scripts/patchSwaggerServer.mjs`: Rewrites swagger server URLs (e.g., to Mockoon or container service).
- `scripts/cloudfront_routing.js`: Helper for CloudFront routing behaviors (404 fallbacks, directories → index.html, etc.).
- `scripts/get-pr-comments.sh`: Utility for collecting PR comments (CI/dev helper).

### Project structure (high-level)
- `pages/`: Next.js pages; includes `pages/swagger.tsx` and i18n assets
- `src/components/`: Reusable UI components (MUI-based)
- `src/features/`: Feature modules (e.g., `landing`, `swagger`, etc.)
- `src/test/`: Tests
  - `e2e/`, `visual/`: Playwright
  - `apollo-server/`, `unit/`: Jest (server/client)
  - `memory-leak/`: Memlab
  - `load/`: K6
- `public/`: Static assets, `swagger-schema.json`
- `scripts/`: Local/CI automation
- `docker/`: Apollo server helper, schema fetcher
- `styles/`: Global css

### Testing details
- Jest is configured via `jest.config.ts` with `TEST_ENV` to switch targets:
  - `TEST_ENV=client` (default) → `src/test/testing-library/**/*.test.tsx`
  - `TEST_ENV=server` → `src/test/apollo-server/**/*.test.ts`
- Playwright config (`playwright.config.ts`):
  - `baseURL` derives from `NEXT_PUBLIC_PROD_CONTAINER_API_URL`
  - Adds a custom header with CloudFront CD values when provided
  - Chromium args are set to ease cross-container testing

### Build and deploy model
- `next.config.js` outputs static export and runs localization generation and chunk splitting.
- Docker multi-stage build:
  - `build` compiles Next and optimizes images into `/app/out`
  - `production` serves `/app/out` via `serve` on port `3001`

### Performance tooling
- Enable bundle analyzer:
```bash
make build-analyze
# or: ANALYZE=true npx next build
```
- Lighthouse CI configs: `lighthouserc.desktop.js`, `lighthouserc.mobile.js`

### Typical Cursor tasks
- Update copy/translations: edit source and re-run dev (`make start`), generator updates localization automatically.
- Add a new page/component: place under `pages/` or `src/components/`, ensure exports are wired, run `lint` and tests.
- Swagger tweaks: modify `scripts/patchSwaggerServer.mjs` or `public/swagger-schema.json` (if pinned); re-run dev/build.
- E2E/visual tests: use `make test-e2e` / `make test-visual` after `start-prod` is auto-handled by the targets.

### Troubleshooting
- Dev not starting in Docker: ensure the network exists (`make create-network`) and port `3000` is free.
- Host-only runs: set `CI=1` to bypass Docker commands.
- Prod wait timeout: verify `NEXT_PUBLIC_PROD_PORT` in `.env` and container health checks.
- Playwright baseURL: when running in containers, use `http://prod:3001`; on host, prefer `http://localhost:3001`.

### Code Review Workflow and PR Refactoring

#### Automated Code Review Comment Retrieval

**CRITICAL**: Always use `make pr-comments` to retrieve and address all code review comments systematically.

This repository includes an automated workflow to fetch all unresolved PR comments and address them methodically.

#### Using the PR Comments Command

Basic usage:
```bash
make pr-comments                    # Auto-detect PR from current branch
make pr-comments PR=215             # Specify PR number explicitly
make pr-comments FORMAT=json        # Output in JSON format
make pr-comments FORMAT=markdown    # Output in Markdown format
```

Command features:
- **Auto-detection**: Detects PR number from current git branch.
- **Multiple formats**: Text (default), JSON, Markdown.
- **GitHub Enterprise support**: Configure via `GITHUB_HOST` env var.
- **Comprehensive output**: File paths, line numbers, authors, timestamps, URLs.
- **Unresolved focus**: Retrieves only unresolved comments needing action.

#### Code Review Refactoring Workflow

1) Retrieve All Code Review Comments
```bash
make pr-comments
```
Shows for each unresolved comment: file path, line number, author, timestamps, full content, and GitHub URL.

2) Analyze Comment Types and Prioritize
- **A. Committable Suggestions (Highest Priority)**: Apply verbatim.
- **B. LLM Prompts/Instructions (High)**: Use as detailed guidance.
- **C. Questions (Medium)**: Reply clearly; improve code clarity where needed.
- **D. General Feedback (Low)**: Consider later.

3) Systematic Implementation Strategy
- **Committable Suggestions**
```bash
git add -A
git commit -m "chore(review): apply reviewer suggestion <short summary>"
```
- **Instructional Comments**
  - Analyze → design → implement → update tests → verify with checks below.
- **Complex Refactors**
  - Split into small commits: abstractions → implementations → migrate usage → remove deprecated code → update tests/docs.

4) Quality Assurance After Each Change
```bash
make format
make lint
make test-unit-all
make start-prod && make test-e2e
# Optional
make test-visual
make test-mutation
```

5) Documentation and Verification
- Update API docs/README/inline comments/ADRs when appropriate.
- Ensure: tests green, coverage acceptable, no regressions, architecture respected.

6) Comment Response Strategy
- Answer questions succinctly; include commit hashes/links for implemented suggestions; explain complex refactors with references; propose alternatives when blocked.

#### Integration with Development Workflow
- Before starting:
```bash
git status
git pull origin main
make pr-comments
```
- During refactoring: handle one comment/group at a time; commit frequently with descriptive messages and comment URLs.
- After all comments:
```bash
make lint && make test-unit-all
make start-prod && make test-e2e
make pr-comments
git push
```
