# ADR 0002: Run every gate in the dev container, with `EXEC_MODE=host` as the escape hatch

- **Status:** Accepted
- **Date:** 2026-09-09 (backfilled; delivered under issue #399)
- **Deciders:** website maintainers
- **Related:** issue #399, ADR 0003

## Context

Before this decision, a CI job provisioned its own toolchain — `actions/setup-node`, a
Bun cache restore, a host `bun install` — and then ran a lint or test command. A
developer ran the same check through `make`, inside the Docker dev image. The two paths
shared a repository and nothing else: different Node patch levels, different install
trees, different native binaries. "Green locally, red in CI" was therefore not evidence
of a bug, and the reverse — a gate that passed in CI because the runner's toolchain
differed — was worse, because nothing reported it.

## Decision

Every gate that drives an npm tool runs **inside the dev container**, locally and in CI
alike. A CI job checks out, runs the [`dev-container` composite
action](../../.github/actions/dev-container/action.yml) — which builds or restores the
`base` image through the BuildKit layer cache and brings the dev service up idle via
`make ci-setup` — and then runs the identical `make <target>` a developer runs. No host
`bun install` remains in those jobs.

`EXEC_MODE` selects the executor: `container` (default) or `host`; any other value is a
hard error. It is deliberately **not** derived from the ambient `CI` variable, which
GitHub Actions sets on every step.

Deliberate exceptions, each for a reason that is about capability rather than
convenience:

- Targets that drive Docker itself or need a toolchain the image does not ship stay on
  the host — among them `lint-metrics` (a host Rust binary), `test-bats`,
  `generate-localization`, `build-out`, `lint-docker-policy`, `lint-pins`,
  `lint-security-txt`, `lint-openapi`, `lint-vulns`, and `lint-workflows`.
- The prod-stack suites (e2e, visual, memory-leak, load, a11y, Lighthouse) drive the
  prod/test compose stacks and stay outside.
- `bats-testing` runs on the host because its subject _is_ the host side of the Makefile.
- `.devcontainer/devcontainer.json` sets `remoteEnv: EXEC_MODE=host`, because it already
  is the container; `make lint-pins` asserts that value.

## Consequences

### What this buys

One command, one image, one answer. A red gate on a runner reproduces on a laptop with
the same `make` invocation, and a gate can no longer pass because a runner happened to
carry a different dependency tree. The image, not a workflow file, is the single place a
toolchain version is declared.

### What this costs

- **Latency.** Every job pays an image build or cache restore before it does any work,
  which is why `dev-image-cache.yml` exists to warm the shared BuildKit cache on `main`
  and weekly against the 7-day eviction window.
- **A split rule that has to be learned.** Several `make lint` members run on the host by
  design, so part of a single `make lint` run straddles the boundary. Placing a new gate
  on the wrong side is a real and recurring mistake.
- **File ownership.** A containerised step writing into the bind mount can leave
  root-owned files that a later host step cannot rewrite — the concrete reason the
  `a11y-testing` job runs both legs with `EXEC_MODE=host`, since a containerised
  component leg leaves the generated `pages/i18n/localization.json` root-owned and the
  host route leg then fails with `EACCES`.
- **The browser suites cannot join.** The `base` stage is Alpine/musl and Playwright
  ships no musl browser builds, so those suites run from a separate glibc image.
- **An escape hatch that can be misused.** `EXEC_MODE=host` exists for the Husky hooks,
  the `run-*-dind` wrappers, and the Lighthouse audits; reaching for it to dodge a
  container failure silently reintroduces exactly the drift this decision removed.

### What would reverse it

A runner image that can host the full toolchain reproducibly, or a container start-up
cost that stops being amortised by the layer cache, would make the latency price no
longer worth paying.
