# ADR 0007: The release lane keeps its orphan tags and enforces a version invariant

- **Status:** Accepted
- **Date:** 2026-09-16
- **Deciders:** website maintainers
- **Related:** ADR 0001, issue #325, issue #331, issue #366, issue #451,
  [`.github/AUTORELEASE.md`](../../.github/AUTORELEASE.md)

## Context

`autorelease.yml` cuts a release on every push to `main`: the changelog action bumps the
`version` in `package.json`, commits `chore(release): vX.Y.Z [skip ci]`, tags the commit
and pushes both with one non-atomic `git push --follow-tags`, and the workflow then
publishes a GitHub release with an SBOM attached.

The lane stopped delivering twice, in two different ways, and both left the same residue:
a tag on the remote that is not an ancestor of `main`.

- **2026-01-20 → the #366 repair.** A history rewrite left `v0.3.1` and `v0.4.0` on the
  remote pointing at commits outside `main` while `package.json` stayed at `0.3.0`. Every
  run recomputed `0.3.0 → 0.4.0` and died on `fatal: tag 'v0.4.0' already exists` — after
  the changelog commit had been written, so each run also corrupted the tree it was
  releasing from. Eight consecutive runs failed; no release shipped.
- **2026-08-27, run 33113478799, the first run after the repair.** `1.6.0 → 1.7.0` was
  computed, the changelog committed, `v1.7.0` tagged. Branch protection on `main` refused
  the commit (`GH006`: commits must be signed, changes must come through a pull request)
  but the same push had already landed the tag. `v1.7.0` now points at `711bbae5`, a commit
  one step off `main` that also carries a freshly generated `website-sbom.cdx.json`.
  `package.json` on `main` still reads `1.6.0`, so every run since fails the preflight.

Three remedies were on the table for the stranded tags: delete them, move them onto
`main`, or leave them and make the version computation skip over them. Deleting rewrites
published history — `v0.4.0`–`v1.6.0` are referenced by the release-audit ledger (#451)
and by any consumer that pinned a tag — and it does not address the cause: the next
rejected push strands the next tag. Moving a tag is the same rewrite under another name.
The branch-protection rejection itself cannot be fixed from a commit: classic protection's
signed-commit rule has no bypass actor, and the workable fix — migrating `main` to a
ruleset that lists the release App as a bypass actor — is a repository setting.

## Decision

We keep every existing tag where it is and hold the release lane to one invariant,
enforced before any write:

> The `version` in `package.json` is at least as high as every existing tag.

`scripts/ci/check-release-version.sh` runs as the first real step of `autorelease.yml`
and fails, with the remedy in its message, when a tag at or above the current version
exists. A collision therefore fails fast and dry instead of half-way through a release.
The invariant is restored by advancing `package.json` through an ordinary pull request,
never by deleting a tag from a workflow.

The push rejection is documented, not worked around: `.github/AUTORELEASE.md` records
the exact `GH006` output, names the ruleset-with-bypass migration as the admin change
that unblocks the lane, and states the strict order of the remedy — grant the bypass
**first**, then either delete `v1.7.0` or bump `package.json` to `1.7.0` — because
doing either while the push is still rejected simply strands `v1.8.0` next. The App's
permission grant is reduced to `Contents: read/write` plus the mandatory metadata read,
which is everything the workflow's token step requests.

Until the admin change lands, every push to `main` produces a red `autorelease` run.
That is deliberate: `ci-health-alerts.yml` lists the release workflow, so the red run
files and refreshes a `ci-alert` issue (#325 gave the alerter the repository context it
was missing), and a silent lane was the failure mode this record exists to end.

Out of scope: the ruleset itself (a setting, tracked with #343), signing the release
commit (a second workable option, rejected in favour of the ruleset because it adds a
private key to the secrets), and any change to how the version is bumped.

## Consequences

### What this buys

The lane can no longer corrupt a release: a collision is caught before the changelog is
written, and the failure names its own fix. Tag history stays intact, so the audit
ledger and any pinned consumer keep resolving. The remaining blocker is one
well-described repository setting, with the order of operations that avoids a third
orphan written down where the person applying it will read it.

### What this costs

- **A red release lane until an admin acts.** Every push to `main` fails
  `autorelease.yml` on the preflight and files a `ci-alert`. That noise is the price of
  a visible blocker; muting the workflow or lowering the check would hide the exact
  defect being tracked.
- **Version numbers carry gaps.** If the maintainers choose the "bump `package.json` to
  `1.7.0`" branch of the remedy, `v1.7.0` remains an orphan and the next release is
  `v1.8.0`; the changelog range is unaffected because the action walks `git log` from
  `HEAD`, but the tag list will always show one number with no release behind it.
- **The orphans stay confusing.** `git tag` lists `v0.3.1`, `v0.4.0` and `v1.7.0`
  alongside real releases; a reader has to consult this record or the audit ledger to
  tell them apart. The tag ledger in `.github/AUTORELEASE.md` is the only place that
  says which tags sit on `main`.
- **Two protections must be bypassed by a bot.** A ruleset bypass for the release App
  is a standing exception to "nothing reaches `main` without a pull request"; the
  release-audit ledger (#383) exists so that exception is recorded on every use.

### What would reverse it

A release model that does not push to `main` at all — publishing the changelog and the
version bump through a pull request the workflow opens, and tagging only after it
merges — would remove both the bypass and the non-atomic push, at the cost of a
human merge on every release. Moving off the conventional-changelog action, or GitHub
shipping an atomic push for `--follow-tags`, would make the preflight redundant but
not wrong.
