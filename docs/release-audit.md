# Release and bot-push audit trail

Issue #383. `.github/workflows/release-audit.yml` and `scripts/ci/release-audit.sh` record
every published release and every push to `main` — including the ones made by the
autorelease bot — into a labelled GitHub issue ledger, mirror each record into the run's
job summary, and escalate anomalies onto the `ci-alert` label that `ci-health-alerts.yml`
already owns.

Read [what the ledger cannot prove](#what-the-ledger-cannot-prove) before you rely on a
record for anything consequential. It is a monitored projection, not a system of record.

## What is recorded

One issue comment per event, on the single permanently-open issue titled
`Release and bot-push audit log` (label `release-audit`). Each record carries:

- the acting identity: `github.actor`, `github.triggering_actor`, the webhook sender and
  its account type, and whether the actor login carries a `[bot]` suffix;
- per commit: the SHA, the subject, the Git author **and** the Git committer (name and
  email, which can differ), the linked GitHub login and account type for each, and the
  signature state (`verified` plus GitHub's `reason`);
- any `*-by:` trailer found in the commit message, explicitly labelled self-declared and
  unverified;
- run provenance: the workflow ref and the full workflow-run URL.

A release record additionally resolves `tag_name` to its commit, so the bot's changelog
push is captured even though no push-triggered workflow can see it.

Example of the commit block, for the real `v0.4.0` release commit:

```text
- commit `1091cc128ece57b6c38c4a8eb20b75b7e199293e`
  - subject: `chore(release): v0.4.0 [skip ci]`
  - author: `Conventional Changelog Action <conventional.changelog.action@github.com>`
    (github: vilnacrm-release[bot], type: Bot)
  - committer: `Conventional Changelog Action <conventional.changelog.action@github.com>`
    (github: vilnacrm-release[bot], type: Bot)
  - signature: verified=false reason=unsigned
  - declared trailers (self-declared, unverified): none
```

Each record embeds an HTML-comment dedup marker (`release-audit:commit:<sha>` or
`release-audit:release:<id>:<class>`). Before writing, the script scans the ledger's
comments from the last 48 hours for that marker, so the three event paths below can
overlap without producing duplicate entries. The lookup is bounded by time, not by ledger
size, so its cost does not grow as the ledger fills.

## Why there are three event paths

A `push: [main]` trigger alone cannot audit the release bot, and this is the single
finding that shapes the whole design.

`TriPSs/conventional-changelog-action` defaults `skip-ci: true`, so every release commit
in this repository ends in `[skip ci]`:

```text
subject=chore(release): v0.4.0 [skip ci]
author=Conventional Changelog Action <conventional.changelog.action@github.com>
committer=Conventional Changelog Action <conventional.changelog.action@github.com>
sig=N
```

GitHub skips `push` and `pull_request` workflow runs whose head commit message contains
`[skip ci]`. A push-only audit would therefore never fire for the very push it exists to
audit, and would look green forever while auditing nothing.

| Path               | Catches                             | Blind to                             |
| ------------------ | ----------------------------------- | ------------------------------------ |
| `release`          | the release, plus its tagged commit | releases that fail before publishing |
| `push` to `main`   | merges, force-pushes, other bots    | anything marked `[skip ci]`          |
| `schedule` (daily) | whatever the other two missed       | up to 24 h of latency                |

The `release` path also depends on `autorelease.yml` creating the release under a GitHub
App installation token rather than the default `GITHUB_TOKEN`: events raised by
`GITHUB_TOKEN` do not start workflow runs. If that ever changes the release path goes
silent with no failure signal, and only the daily sweep still records the commit.

## Loop safety

This workflow is triggered by pushes to `main`, and the autorelease bot pushes
`CHANGELOG.md` to `main`. It must therefore never write to the repository, or it becomes
its own trigger. Three properties enforce that:

1. The job holds `contents: read` and `issues: write`. The `contents` scope is never
   elevated past read anywhere in the file.
2. `scripts/ci/release-audit.sh` invokes no version-control command at all. Both facts are
   asserted directly by `tests/bats/release_audit.bats`.
3. Its only writes are issue comments made with `GITHUB_TOKEN`, and events raised by
   `GITHUB_TOKEN` do not start new workflow runs.

The concurrency group is deliberately **not** keyed on `github.ref`, unlike every other
workflow here: a release event runs on `refs/tags/vX.Y.Z` while a push runs on
`refs/heads/main`, and both mutate the same ledger issue, so a ref-keyed group would let
two runs race to create it. Please do not "standardise" it.

## Escalations

Routine events produce a ledger comment only — anyone subscribed to the ledger issue is
notified. These three additionally open or refresh a `ci-alert` issue:

- `main` was force-pushed;
- a release was `edited` or `deleted` (releases are immutable by convention here);
- the release author, or a `[bot]` actor pushing to `main`, is not the declared release
  App. This one is **opt-in** and stays silent until `RELEASE_BOT_ACTOR` is configured.

## What the ledger cannot prove

Being precise about this matters more than the feature itself.

**Identity is not agent identity.** An AI agent committing through a maintainer's local
Git configuration is indistinguishable from that maintainer at the Git layer. A record
reading `author: Rudoi Dmytro` is _not_ evidence that a human wrote the change. The record
prints the verifiable identity and nothing more.

**Trailers are self-declared and unauthenticated.** This repository's `main` history does
contain trailers — 129 `Signed-off-by:` lines and 106 `Co-authored-by:` lines — but they
are GitHub squash-merge co-authors and DCO sign-offs, and **zero** of them identify an
automated agent. `commitlint.config.js` extends `@commitlint/config-conventional` plus a
rule that only checks the header matches `type(#123):`; nothing in this repository
produces, requires, or verifies an agent-attribution trailer. The ledger reports whatever
trailers exist, labelled unverified, and prints `none` otherwise — it does not invent a
convention that nothing enforces.

**The ledger is not tamper-evident.** Any maintainer with write access can edit or delete
an issue comment, and no record is signed. The tamper-evident record is GitHub's
organisation audit log (Settings → Audit log), which can be streamed to external storage;
this ledger exists to make releases and bot pushes _visible and notifying_ inside the
repository, and to add per-commit signature and authorship detail the audit log does not
surface. Job summaries are effectively immutable but expire with the workflow run, which
is why they are a mirror rather than the store.

**Unsigned is the norm here, not an anomaly.** The release bot pushes over Git with an App
token rather than through the contents API, so its commits are unsigned (`verified=false`,
`reason=unsigned`). The signature field is recorded so a _change_ in that pattern is
visible; it is not a pass/fail gate.

## Setup

Optional, and only needed for the "unexpected bot" escalation. Under
Settings → Secrets and variables → Actions → Variables, set:

- `RELEASE_BOT_ACTOR` — the release App's login, for example `vilnacrm-release[bot]`.
  While it is unset every event is still recorded; only the unexpected-bot escalation is
  suppressed.

It is a variable, never a secret. A guessed default would raise a false alert on every
single release, which is why it ships opt-in.

Then subscribe to the `Release and bot-push audit log` issue — that subscription is what
turns the ledger into an alert. The issue and both labels are created on first use.

## Exercising it

The suite in `tests/bats/release_audit.bats` drives every branch of the script against a
stubbed `gh`, plus the workflow-file invariants, so the whole thing is covered at PR time
without cutting a release:

```bash
bun x bats --formatter tap tests/bats/release_audit.bats
```

Against the real GitHub API, read-only:

```bash
make release-audit-dry-run AUDIT_EVENT=release AUDIT_REF=v0.4.0
make release-audit-dry-run AUDIT_EVENT=push AUDIT_REF=1091cc12
make release-audit-dry-run
```

That target forces `AUDIT_DRY_RUN=1`, so it can only ever print the record it _would_ have
written. It needs `gh`, `jq`, and GNU `date` (the `-d '-N hours'` form is not portable to
BSD/macOS `date`), and it is therefore Linux-only.

Finally, `workflow_dispatch` with `dry_run: true` (the default) exercises the live path.
GitHub only exposes dispatch for workflows on the default branch, so this is a post-merge
smoke test, not a PR gate — a green PR is not evidence that the live wiring works. The
first real write should be `mode: sweep`, `dry_run: false`, which creates the ledger and
records the last day of `main`.
