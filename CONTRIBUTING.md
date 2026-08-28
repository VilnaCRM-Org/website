# Welcome to contributing guide

Thank you for investing your time in contributing to our project!

Read our
[Code of Conduct](https://www.contributor-covenant.org/version/2/0/code_of_conduct/)
to keep our community approachable and respectable.

In this guide you will
get an overview of the contribution
workflow from opening an issue, creating a PR, reviewing, and merging the PR.

Use the table of contents icon on the top left corner
of this document to get to a specific section of this guide quickly.

## New contributor guide

To get an overview of the project,
read the [README](README.md). Here are some resources
to help you get started with open source contributions:

- [Frontend onboarding wiki](https://github.com/VilnaCRM-Org/website/wiki/Onboarding)
- [Finding ways to contribute to open source on GitHub](https://docs.github.com/en/get-started/exploring-projects-on-github/finding-ways-to-contribute-to-open-source-on-github)
- [Set up Git](https://docs.github.com/en/get-started/quickstart/set-up-git)
- [GitHub flow](https://docs.github.com/en/get-started/quickstart/github-flow)
- [Collaborating with pull requests](https://docs.github.com/en/github/collaborating-with-pull-requests)

### Issues

#### Create a new issue

If you spot a problem with this template,
[search if an issue already exists](https://docs.github.com/en/github/searching-for-information-on-github/searching-on-github/searching-issues-and-pull-requests#search-by-the-title-body-or-comments).
If a related issue doesn't exist, you can open a new issue using a relevant [issue form](https://github.com/VilnaCRM-Org/website/issues/new).

#### Solve an issue

Scan through our [existing issues](https://github.com/VilnaCRM-Org/website/issues)
to find one that interests you. You can narrow down the search using `labels` as filters.
As a general rule, we don’t assign issues to anyone.
If you find an issue to work on, you are welcome to open a PR with a fix.

### Make Changes

#### Make changes locally

1. Fork the repository.

- Using GitHub Desktop:
  - [Getting started with GitHub Desktop](https://desktop.github.com/download/)
    will guide you through setting up Desktop.
  - Once Desktop is set up, you can use
    it to [fork the repo](https://docs.github.com/en/desktop/contributing-and-collaborating-using-github-desktop/cloning-and-forking-repositories-from-github-desktop)!

- Using the command line:
  - [Fork the repo](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo#forking-a-repository)
    so that you can make your changes without affecting the original project until
    you're ready to merge them.

1. Install or update to **Docker** and **Docker compose**. For more information, see [the README](README.md).

2. Create a working branch and start with your changes!

#### Maintain Makefile shell coverage

If your change adds or updates a Makefile target, keep the shell-coverage inventory in
sync:

- Update `tests/bats/make-target-coverage.tsv` so every Makefile target is marked as
  either Bats-covered or already covered by a pull request workflow.
- If the target is not already exercised by CI, add or update the relevant test in
  `tests/bats/`.
- Run `make test-bats`.

#### Run the CI phases locally

Before opening a pull request you can reproduce the pipeline's grouped phases
locally with the CI orchestration targets:

- `make ci` runs the full flow (setup → lint → dev tests → mutation → prod
  setup → prod tests).
- Run a single phase with `make ci-lint`, `make ci-test`, `make ci-mutation`,
  or `make ci-test-prod`; `make ensure-dev` starts the dev container only when
  it is not already running.
- The individual `ci-test-*` entrypoints (e.g. `ci-test-unit-client`,
  `ci-test-e2e`) assume the matching `ci-setup` / `ci-prod-setup` phase already
  prepared the environment, mirroring how CI fans them out.

When you add a new orchestration target, keep
`tests/bats/make-target-coverage.tsv` in sync as described above.

#### How the PR pipeline runs in parallel

Every check on a pull request is its own workflow on its own runner, so GitHub
runs them all in parallel — the PR is only as slow as the slowest single job,
not the sum. This is an orchestration-only layout: the same checks run on every
PR at the same thresholds; nothing is moved to a nightly tier, weakened, or
removed.

- **Concurrency.** Every workflow declares a `concurrency` group keyed on the PR
  (or ref). PR checks set `cancel-in-progress: true`, so a new push cancels the
  superseded run instead of letting its slow jobs run to completion. The deploy,
  release, and sandbox workflows use `cancel-in-progress: false` — a production
  trigger must never be aborted mid-run, so newer pushes queue behind the
  current one.
- **Caching.** Node jobs restore the Bun cache (`~/.bun/install/cache`, keyed on the
  Node version and `bun.lock`) so installs are warm instead of cold.
- **Matrices instead of serial steps.** The Playwright e2e suite splits across a
  Playwright `--shard` matrix (one balanced slice of the ~340 test runs per
  runner), Lighthouse runs `desktop` and `mobile` as parallel cells, the K6 load
  suites (homepage, Swagger) run as parallel cells, and mutation testing runs as
  a shard matrix (see below).

#### Mutation testing runs sharded

Mutation testing runs as a deterministic shard matrix plus a merge gate:

- Each `shard` cell runs `make test-mutation-shard` (with `MUTATION_SHARD_INDEX`
  and `MUTATION_SHARD_TOTAL`), which slices the `mutate` list from
  `stryker.config.mjs` (via `stryker.shard.config.mjs`) and writes
  `reports/mutation/mutation-shard-<i>.json` with `break` disabled.
- The `merge` job runs `make merge-mutation-reports` (with `MUTATION_SHARD_TOTAL`),
  which unions the per-shard reports and re-enforces the **exact** `break`
  threshold read from `stryker.config.mjs`
  ([`scripts/ci/merge-mutation-reports.ts`](scripts/ci/merge-mutation-reports.ts),
  unit-tested in `src/test/unit/mutation-report.test.ts`).

The round-robin split is a total partition of `mutate`, so the union equals the
full list and the sharded score is identical to an unsharded run — the gate is
preserved, never relaxed. The merge job runs even when a shard fails, so the
gate fails closed rather than passing vacuously.

#### E2E flakes are detected, not retried away

`playwright.config.ts` sets `retries: 2` in CI, so a spec that fails and then
passes is reported green and the flake signal is thrown away. That is how the
WebKit swagger flake in #290 reached the production CodePipeline. Two jobs in
`e2e-testing.yml` recover the signal, both scoped to the specs your pull request
actually changed:

- **`e2e flake gate`** reads every shard's Playwright JSON report
  (`test-results/results.json`) through
  [`scripts/ci/flaky-report.ts`](scripts/ci/flaky-report.ts) and fails when a
  changed spec carries Playwright's `flaky` status — i.e. it only passed on a
  retry. Like the mutation merge gate, it runs even when a shard failed so it
  cannot pass vacuously.
- **`burn in changed e2e specs`** runs `make test-e2e-burnin` on those specs with
  `--repeat-each=5 --retries=0`. Two or more failures out of five is a flake;
  a single failure is tolerated so one-off infrastructure blips do not block a
  pull request.

Flaky specs you did **not** touch are reported as annotations rather than
failures, so the pre-existing backlog does not block unrelated work; the nightly
`e2e flake census` workflow repeats the whole suite off the PR path and records
what it finds in an `e2e-flake`-labelled issue.

If a burn-in goes red, fix the nondeterminism at its source. Adding a
`waitForTimeout`, widening `retries`, or wrapping the assertion in a condition
defeats the gate and is not an acceptable fix.

#### Memory leaks fail the job

`make test-memory-leak` used to run memlab and discard its findings, so a run
that detected fifty leak clusters exited 0 exactly like a clean one. The runner
now reads the clusters and exits non-zero, printing the retainer traces for the
scenarios that failed.

Clusters that already existed when the gate was armed are recorded in
[`src/test/memory-leak/leak-baseline.json`](src/test/memory-leak/leak-baseline.json),
each with a reason, a tracking issue, and a `validUntil` date — the gate fails
once that date passes, so accepted debt cannot become permanent. An allowance is
only ever for debt that predates the gate: if your change introduces a leak, fix
the retainer.

Cluster counts differ between environments — `swaggerInteractions` clusters at
13 on a GitHub-hosted runner and 28–29 locally — so an allowance records the
maximum seen anywhere. A run below its allowance therefore prints a `ratchet`
notice rather than failing. Do not act on a single low reading: lowering an
allowance to a CI-only figure turns every local run red.

#### Dockerfile build performance

If your change touches a `Dockerfile` (or the gate's own config), a CI gate
rebuilds each configured image, measures its size and build time, and runs
`dive` and `hadolint` checks against per-image budgets. The check hard-fails a
pull request when a budget or gate is exceeded, unless a documented exception
applies. Budgets live in `.github/dockerfile-perf.json`, and exceptions are
granted via an inline `# perf-exception: <reason>` marker or the
`docker-perf-exception` PR label. See
[docs/dockerfile-performance.md](docs/dockerfile-performance.md) for the full
policy, thresholds, and tuning guide.

#### Accessibility (WCAG 2.1 AA)

If your change renders UI or adds a route, it has to pass the accessibility gate.
`make test-a11y` runs both halves: `jest-axe` over rendered components in jsdom,
and `@axe-core/playwright` plus a keyboard sweep over every registered route in
Chromium, Firefox and WebKit. CI runs the same target as its own required check
(`.github/workflows/a11y-testing.yml`), separate from `static testing` (the
`jsx-a11y` lint rules) and `performance testing` (the Lighthouse accessibility
category score) — those are heuristics, this one asserts per rule.

A new page must be added to `src/test/a11y/routes.ts`; a unit test fails when
that registry drifts from `pages/`. The axe tag list and the exception allowlist
live only in `src/test/a11y/axe-config.ts`.

Never make the gate pass by suppressing it — no `eslint-disable`, no axe rule
removal, no `test.skip`, and never an `if (count > 0)` / `if (isVisible())`
wrapper around an assertion (a guarded assertion that never runs reports green,
which is worse than no test). Accepted debt goes through the documented
exception allowlist with a rule id, a scope, a reason, and a tracking issue. See
[docs/accessibility/acceptance-standard.md](docs/accessibility/acceptance-standard.md)
for the conformance target, what automation does not cover, and the exception
process.

#### Code metrics (rust-code-analysis)

A CI gate runs Mozilla `rust-code-analysis` over `src/` on every pull request to
`main` and hard-fails when a function or file exceeds a complexity budget
(cyclomatic, cognitive, Halstead, size/LOC, ABC, NARGS, NEXITS, NOM, or the
Maintainability-Index floor). The budgets live in
[`config/metrics-policy.json`](config/metrics-policy.json) and the gate is its
own workflow, separate from `make lint` — run it locally with `make
lint-metrics` (it auto-installs the pinned CLI to `./bin` and never uses the dev
container). See the README's "Code Metrics (rust-code-analysis)" section for what
is enforced and how to read a failure.

If a change trips the gate, **fix the offending code first** — extract helpers,
split a god-file, or simplify dense expressions. When a higher budget is
genuinely warranted, raise the relevant threshold in `config/metrics-policy.json`
as a reviewed, in-repo change visible in the PR diff (or confirm the path belongs
outside the governed scope). Never silence the gate with a local override or a
per-line disable.

#### Workflow security (zizmor)

Anything you change under `.github/workflows` is audited by
[zizmor](https://docs.zizmor.sh) on every pull request through its own workflow,
`workflow-security.yml`. Run it locally with `make lint-workflows` (host-only,
Docker, deliberately outside `make lint`).

The gate fails on medium-and-above findings reported with high confidence. In
practice that means: pin every `uses:` to a full 40-character commit SHA with a
trailing comment naming the tag that SHA **actually** points at — copy the tag
verbatim, including whether upstream writes it `v1.5.0` or `1.5.0`, because
zizmor compares the comment against the real tag and flags a mismatch —
keep `permissions:` scoped to the job that needs them, never use an archived
action, and never interpolate `${{ }}` into a `run:` body — pass values through
`env:` and reference `"$VAR"`.

If the gate fails, fix the workflow. Never add a `zizmor.yml` ignore rule, a
`# zizmor: ignore[...]` comment, or lower `ZIZMOR_MIN_SEVERITY` /
`ZIZMOR_MIN_CONFIDENCE` in the Makefile — those thresholds are a ratchet that
only moves up as the remaining low-severity clusters are cleared.

#### Upstream contracts (user-service)

Every user-service contract this repo consumes — the GraphQL schema behind the
Apollo mock, the OpenAPI spec behind the swagger page, and the Mockoon fixture
behind the e2e suite — comes from the single `USER_SERVICE_VERSION` pin in
[`.env`](.env). The fetched artifacts are committed under
[`contracts/`](contracts) so `docker build` and `make start` never depend on
`raw.githubusercontent.com` being up.

`make lint-contracts` (its own workflow, `contract-testing.yml`, and
deliberately outside `make lint` because it needs network) checks that:

- every client GraphQL operation still validates against the pinned schema;
- the OpenAPI document lints against an unmodified `spectral:oas` ruleset; and
- the committed artifacts still match the pinned tag.

To bump the upstream version, change `USER_SERVICE_VERSION` and run `make
update-contracts` — it re-fetches both artifacts and refreshes the spectral
baseline. Commit the resulting diff; it is the reviewable record of what
changed upstream.

Two further gates keep the **mock** honest, because the whole Playwright suite
talks to Mockoon rather than a real backend and a green e2e run therefore only
proves the app agrees with the mock:

- **`make test-contract` (blocking, every PR).** Boots Mockoon in-process from
  the committed document and holds every documented operation's response against
  it — status, media type, schema, and no property the schema never declares.
  Its CI home is
  [`contract-parity-testing.yml`](.github/workflows/contract-parity-testing.yml);
  the status-check name a maintainer must add to the `main` required-checks
  ruleset is **`contract parity testing / mock-contract-parity`** (branch
  protection is a repository setting and cannot be committed).
  It also validates the swagger e2e fixtures against the same schema and pins the
  `@mockoon/*` libraries to the `@mockoon/cli` version `Mockoon.Dockerfile`
  installs. When it goes red, fix the mock or the contract — never relax a rule.
  If you bump one Mockoon pin, bump both in the same commit.
- **`make lint-openapi` (advisory, nightly).** Reports breaking changes between
  the committed baseline and the newest upstream **release** using a pinned,
  SHA256-verified `oasdiff`. Upstream moving on is not a PR author's fault, so
  [`openapi-drift.yml`](.github/workflows/openapi-drift.yml) files or refreshes an
  `api-contract` tracking issue instead of failing a check, and closes it once
  the baseline is current again. Like `lint-contracts` and `lint-metrics` it sits
  outside `make lint` — it needs the network and a host binary.

Both gates read the single committed baseline. Do not add a second copy of the
spec: it would drift with nothing watching it.

The baseline in [`contracts/spectral-baseline.json`](contracts/spectral-baseline.json)
records defects in the upstream spec that this repo does not control. It is not
a suppression list: the gate fails on any finding **not** in it, and equally on
any baselined finding that disappears, so an upstream fix shrinks the baseline
instead of leaving it stale. Never add an entry to silence a defect in code we
own — fix the code.

### Commit your update

Commit the changes once you are happy with them.
Don't forget to self-review to speed up the review process:zap:.

Our commits are based on [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

### 💡 Encountering Issues?

If you're unsure about how to proceed with your changes, you have two options:

- **Contact your team lead** for guidance.
- **Push your changes** to a branch and **open a pull request** — this will trigger
  an automated code review.

### 🔗 Link Checking

`.github/workflows/link-check.yml` runs [lychee](https://lychee.cli.rs/) in two legs, and
they have deliberately different jobs:

- **Offline (blocking, every PR).** Resolves relative links and `#fragment` anchors across
  every git-tracked Markdown file, with external URLs skipped so a third party's outage can
  never flake a required check. This is also the leg that rejects root-relative Markdown
  links (`/some/path`) outright — keep them relative.
- **External (advisory, Mondays).** Resolves external URLs too, over Markdown plus the built
  `out/` export, and files or refreshes the _Weekly link check failures_ tracking issue
  instead of blocking.

Because the weekly leg reports rather than blocks, treat a noisy report as a bug in the leg:
it is only useful while every entry is a real dead link. Fix the link, or fix the checker —
never let phantom findings accumulate.

### 🤖 Automatic Code Review

Once you open a pull request, [CodeRabbitAI](https://coderabbit.ai/) will automatically review
your code and leave comments.

These comments may help identify potential issues such as logic errors, style inconsistencies,
or opportunities for refactoring — giving you actionable suggestions before human review.

### Pull Request

When you're finished with the changes, create a pull request, also known as a PR.

- Fill the "Ready for review" template so that we can
  review your PR. This template helps reviewers understand your changes as well
  as the purpose of your pull request.
- Don't forget to [link PR to issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/linking-a-pull-request-to-an-issue)
  if you are solving one.
- Enable the checkbox to [allow maintainer edits](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/allowing-changes-to-a-pull-request-branch-created-from-a-fork)
  so the branch can be updated for a merge. Once you submit your PR, our team member
  will review your proposal. We may ask questions or request additional information.
- We may ask for changes to be made before a PR can be merged, either using
  [suggested changes](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/incorporating-feedback-in-your-pull-request)
  or pull request comments. You can apply suggested changes directly through the UI.
  You can make any other changes in your fork, then commit them to your branch.
- As you update your PR and apply changes, mark each conversation as
  [resolved](https://docs.github.com/en/github/collaborating-with-issues-and-pull-requests/commenting-on-a-pull-request#resolving-conversations).
- If you run into any merge issues, checkout this
  [git tutorial](https://github.com/skills/resolve-merge-conflicts) to help you
  resolve merge conflicts and other issues.

### Your PR is merged

Congratulations :tada::tada: The our team thanks you :sparkles:.
