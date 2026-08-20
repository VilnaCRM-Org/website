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
  - [Fork the repo](https://docs.github.com/en/github/getting-started-with-github/fork-a-repo#fork-an-example-repository)
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

The baseline in [`contracts/spectral-baseline.json`](contracts/spectral-baseline.json)
records defects in the upstream spec that this repo does not control. It is not
a suppression list: the gate fails on any finding **not** in it, and equally on
any baselined finding that disappears, so an upstream fix shrinks the baseline
instead of leaving it stale. Never add an entry to silence a defect in code we
own — fix the code.

#### One Node version (`.nvmrc`)

[`.nvmrc`](.nvmrc) is the single authoritative Node version for this repository.
Everything else must agree with it, and `make lint-node-version` — part of the
aggregate `make lint`, so it runs on every pull request through
`static-testing.yml` — fails when anything does not:

- a `FROM …node:<version>` base image in any Dockerfile;
- `package.json` `engines.node`, which must be the caret over the exact `.nvmrc`
  version (`^24.18.0`), not a looser range like `^24` that merely admits it;
- an `actions/setup-node` step that pins a version instead of reading
  `node-version-file: '.nvmrc'`;
- any workflow reaching for a `vars.NODE_VERSION` repository variable, whose value
  cannot be seen or reviewed from inside the repository.

To move Node, edit `.nvmrc` first and then run the gate: it names every source that
still lags. Never loosen a source to make it pass. The separate
`make check-node-version` target answers a different question — whether the Node you
are _running_ satisfies `engines`.

#### Coverage reporting

`make test-unit-all` runs the client, server and edge Jest layers and `make
test-integration` runs the fourth; each writes its own report under `coverage/<layer>/`.
Every layer also enforces its own `coverageThreshold` in
[`jest.config.ts`](jest.config.ts); those thresholds are the gate, and they only ever
move up. `.github/workflows/codecov.yml` runs all four suites and uploads all four
reports under matching Codecov flags — `client`, `server`, `edge` and `integration` —
and [`codecov.yml`](codecov.yml) turns the resulting project and patch statuses into
real, non-informational checks. The integration report is the only one collected over
the whole of `src/**`; the other three measure just the files their tests import, so
without it the uploaded picture cannot see a module with no test at all. Uploads fail
closed once the `CODECOV_TOKEN` repository secret is configured; until then the job
prints a warning saying so rather than reporting a discarded upload as success.

#### Flaky tests

A test that passes only on a retry is a defect. The detection, triage, quarantine and
never-do rules live in the [`agents.md`](agents.md) "Flaky Tests" section and apply to
human contributors and AI agents alike.

### Commit your update

Commit the changes once you are happy with them.
Don't forget to self-review to speed up the review process:zap:.

Our commits are based on [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

### 💡 Encountering Issues?

If you're unsure about how to proceed with your changes, you have two options:

- **Contact your team lead** for guidance.
- **Push your changes** to a branch and **open a pull request** — this will trigger
  an automated code review.

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
