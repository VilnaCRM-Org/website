# Dockerfile build performance

A CI gate that keeps our container images small and well-built. On every pull
request that touches a Dockerfile or one of the gate's own files, the gate
rebuilds each configured image, measures it, runs three quality gates, and
posts a single PR comment with the results. If a gate is exceeded, the check
hard-fails the PR unless a documented exception applies.

## Overview

The gate is defined by the workflow
[`.github/workflows/dockerfile-performance.yml`](../.github/workflows/dockerfile-performance.yml)
and driven by the script [`scripts/ci/docker_perf.sh`](../scripts/ci/docker_perf.sh).
It triggers on `pull_request` to `main`, but only when one of these paths
changes:

- `Dockerfile`
- `src/test/load/Dockerfile`
- `.github/dockerfile-perf.json` (the config / source of truth)
- `.github/workflows/dockerfile-performance.yml` (the workflow itself)
- `scripts/ci/docker_perf.sh` (the gate script)
- `.hadolint.yaml`
- `.dive-ci`

For each configured image the gate builds **two** versions: the PR-head
version and the base-branch version. That lets the PR comment show the size
delta your change introduces, not just the absolute size.

> **Cross-repo note:** This check is implemented self-contained in each
> VilnaCRM repo (`website`, `ui-toolkit`, `crm`). There is intentionally no
> central shared workflow — each repo owns its own copy so it can evolve
> independently. Keep that framing when porting changes between repos.

## What it measures

For every image listed in the config the gate records:

- **Final image size** — uncompressed bytes from `docker image inspect`.
- **Δ vs base branch** — the size difference between your PR-head build and the
  base-branch build of the same image.
- **Build time** — wall-clock time for the build.
- **Budget** — the configured size budget for that image.
- **Status** — pass, fail, or waived (when an exception applies).

These land in a single sticky PR comment as a table:

| Image | Dockerfile | Size | Δ vs base | Build time | Budget | Status |
| ----- | ---------- | ---- | --------- | ---------- | ------ | ------ |

The comment is updated in place on each push (it does not stack new comments).

## Gates and thresholds

All three gates must pass, or the check fails.

### 1. Size budget

The build fails when the final image size exceeds
`budget_mb * (1 + tolerance_pct / 100)`. The comparison uses integer math on
the uncompressed byte count reported by `docker image inspect`. The budget and
tolerance are per-image and come from the config (see below).

### 2. Layer efficiency (`dive`)

Run via `dive --ci` using [`.dive-ci`](../.dive-ci). It catches duplicated or
leaked files that bloat earlier layers. Thresholds:

| Rule                       | Value  | Meaning                                             |
| -------------------------- | ------ | --------------------------------------------------- |
| `lowestEfficiency`         | `0.90` | Fail if image efficiency drops below this ratio.    |
| `highestWastedBytes`       | `20MB` | Fail if total wasted space reaches this size.       |
| `highestUserWastedPercent` | `0.15` | Fail if wasted space is this fraction of the image. |

### 3. Best-practice / performance rules (`hadolint`)

Run via `hadolint` using [`.hadolint.yaml`](../.hadolint.yaml) with
`failure-threshold: warning`. The build fails on any rule at `warning`
severity or above — for example untagged base images, missing `apk`/`apt`
version pins, or a missing `--no-install-recommends`. Rule `DL3059`
(consecutive `RUN` instructions) is ignored on purpose, because `dive` already
measures the real layer waste that rule only guesses at.

## Per-image budgets

The config [`.github/dockerfile-perf.json`](../.github/dockerfile-perf.json) is
an array and the single source of truth. Each entry has: `name`,
`dockerfile`, `context`, `target` (an empty string means no `--target`),
`budget_mb`, and `tolerance_pct`. **Adding a Dockerfile to the gate is just
adding an entry.**

| Name      | Dockerfile                 | Target       | Budget  | Tolerance | Current size |
| --------- | -------------------------- | ------------ | ------- | --------- | ------------ |
| `website` | `Dockerfile`               | `production` | 480 MiB | 10%       | ~459 MiB     |
| `load-k6` | `src/test/load/Dockerfile` | _(none)_     | 25 MiB  | 15%       | ~18 MiB      |

The effective cap is `budget_mb × (1 + tolerance_pct / 100)` — 528 MiB for
`website` and ~28.75 MiB for `load-k6`.

The budgets are a **calibration baseline** measured from real builds: each sits
just above the current image size so it catches regressions without flagging
the status quo. As images are slimmed, **ratchet the budgets down** over time
so the gate keeps protecting the gains.

## Exceptions

Some images legitimately cannot be slimmed — for example glibc-only toolchains
such as Playwright's bundled browsers. (The lesson behind this gate: Alpine /
musl is **not** always a viable base.) For those cases there are two documented
ways to waive a gate. When an exception applies, the failing gate is reported
as **waived** and the check passes — **without** weakening the gates for any
other image.

A waiver must carry a real reason and should be reviewed. Do not use it to
paper over an image that could be slimmed with reasonable effort.

### Option A — inline Dockerfile marker (per-image, preferred)

Add a marker comment inside the specific Dockerfile. It is self-documenting,
scoped to that one image, and a reason is **required**:

    # perf-exception: Playwright ships glibc-only browser binaries; Alpine/musl is not viable here

### Option B — PR label (repo-wide for that PR)

Apply the PR label `docker-perf-exception`. This waives failing gates for the
whole PR. Prefer Option A unless you genuinely need a PR-wide waiver, because
the inline marker documents the reason next to the code.

## Tuning the budgets

To change a budget or tolerance, edit the relevant entry in
[`.github/dockerfile-perf.json`](../.github/dockerfile-perf.json):

- `budget_mb` — the size budget in MiB.
- `tolerance_pct` — headroom above the budget before the size gate fails.

To bring a **new** image under the gate, append a new object with `name`,
`dockerfile`, `context`, `target`, `budget_mb`, and `tolerance_pct`. The
workflow builds its matrix straight from this file, so no workflow edit is
needed. Remember to also add the new Dockerfile path to the workflow's `paths`
trigger if you want the gate to run when that file changes.

The general direction of travel is **down**: when you slim an image, lower its
budget in the same PR so the savings are locked in.

## How it runs in CI

1. The `setup` job reads `.github/dockerfile-perf.json` and turns it into a
   build matrix.
2. The `performance` job runs once per image (`fail-fast: false`, so every
   image is reported even if one fails). It checks out both the PR head and the
   base branch, sets up Buildx, builds and measures both versions, runs the
   three gates, and uploads the metrics as an artifact.
3. The `comment` job downloads all metrics and posts/updates the single sticky
   PR comment (header `docker-build-perf`).

The gate **only runs when a Dockerfile or one of the gate's own files
changes** (see the trigger list in [Overview](#overview)). PRs that touch
nothing relevant skip it entirely.

## Troubleshooting

**My PR failed the size budget.** You have three options, roughly in order of
preference:

1. **Slim the image.** Use a smaller base, drop build-only dependencies from
   the final stage, combine or reorder layers, or add a multi-stage `--target`.
   Check the `dive` output to see where the bytes are.
2. **Justify an exception.** If the image genuinely cannot be slimmed (see
   [Exceptions](#exceptions)), add a `# perf-exception: <reason>` marker or the
   `docker-perf-exception` label. The reason must be real and will be reviewed.
3. **Raise the budget — with reviewer sign-off.** If the larger size is a
   legitimate, permanent increase, bump `budget_mb` / `tolerance_pct` in the
   config and explain why in the PR. Don't raise the budget just to make the
   check green.

**My PR failed `dive` (layer efficiency).** You are shipping duplicated or
leaked files. Common causes: copying a directory and then deleting part of it
in a later layer (the deleted bytes still live in the earlier layer), or
installing then removing packages across separate `RUN` steps. Combine the
add-and-remove into a single layer, or copy only what you need.

**My PR failed `hadolint`.** Read the rule code in the log. Typical fixes: pin
the base image tag, pin `apk`/`apt` package versions, add
`--no-install-recommends`. See [`.hadolint.yaml`](../.hadolint.yaml) for the
configured threshold and ignored rules.

**The gate didn't run on my PR.** It only triggers when a path in the trigger
list changes. If you changed application code without touching any Dockerfile
or gate file, that is expected.

**The check failed but I think it's a false positive.** Open the `performance`
job log to see which gate failed and why, then download the
`docker-perf-<name>` artifact for the raw metrics. If the image truly can't be
slimmed, use the [exception mechanism](#exceptions) rather than disabling the
gate.
