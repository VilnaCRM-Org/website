# ADR 0011: The release lane pushes its commit and tag atomically, after a scope check

- **Status:** Accepted
- **Date:** 2026-09-25
- **Deciders:** website maintainers
- **Related:** ADR 0007, issue #481, issue #366, issue #343,
  [`.github/AUTORELEASE.md`](../../.github/AUTORELEASE.md),
  `.github/workflows/autorelease.yml`, `scripts/ci/push-release.sh`

## Context

ADR 0007 kept the orphan tags and added a version preflight, and it said plainly what that
did not fix: the push stayed non-atomic. `TriPSs/conventional-changelog-action` ended every
release with `git push origin <branch> --follow-tags`, and GitHub accepts or refuses each ref
in such a push on its own. On 2026-08-27 (run 33113478799) branch protection refused the
unsigned, pull-request-less release commit (`GH006`) while the tag in the same push landed.
That stranded `v1.7.0` on `711bbae5`, one commit off `main`, and the preflight has failed
every run since (issue #481).

The same commit showed a second defect. The workflow generates `website-sbom.cdx.json` in
the workspace before the changelog action runs, and the action stages with `git add .`, so
the SBOM was committed into the release commit next to `CHANGELOG.md` and the
`package.json` bump.

The action can be told not to push. With `git-push: 'false'` it still bumps, commits and
tags locally and still sets its `tag` and `skipped` outputs (`src/index.js` at the pinned
revision), and its `init()` has already rewritten `origin` to an authenticated URL, so a
later step can push through the same remote. The branch-protection rejection itself is a
repository setting (the ruleset bypass tracked with #343), and no commit can change it.

## Decision

We push the release commit and its tag ourselves, in one `git push --atomic`, and only
after checking that what we push is exactly a release.

- `autorelease.yml` runs the changelog action with `git-push: 'false'` and adds a
  `Push the release commit and tag atomically` step between it and `Create Release`. The
  step is guarded by `steps.changelog.outputs.skipped == 'false'`, and the tag and branch
  reach it through `env:`, never through `${{ }}` inside `run:`.
- `scripts/ci/push-release.sh <tag> <branch>` refuses, before any network call, when the
  tag is not a plain `vMAJOR.MINOR.PATCH`, when the tag does not name `HEAD`, when
  `package.json` at `HEAD` carries a different version, when the release commit is not a
  single-parent commit, or when it changes anything other than `package.json` and
  `CHANGELOG.md`. It then runs
  `git push --atomic --no-follow-tags origin HEAD:refs/heads/<branch> refs/tags/<tag>`.
- `.gitignore` lists `/website-sbom.cdx.json` and `/release-notes.md`, so the action's
  `git add .` no longer picks them up. The scope check is the second line of defence
  against any other stray workspace file.
- `tests/bats/release_push.bats` proves the change against a bare remote whose `update`
  hook refuses `main`. A plain `--follow-tags` push strands the tag there, which
  reproduces #481, and the script leaves no tag behind. `tests/bats/autorelease_workflow.bats`
  parses the workflow and pins the wiring.

The preflight from ADR 0007 stays. The orphans `v0.3.1`, `v0.4.0` and `v1.7.0` still
exist, and an atomic push does nothing about a tag that is already on the remote. The
remedy order in ADR 0007 also stays: grant the bypass first, then delete `v1.7.0` or bump
`package.json`. An early bump or deletion is no longer dangerous, but nothing can ship
before the bypass either way, and the preflight's failure names the stranded tag while a
refused push only reports the refusal.

Out of scope: the ruleset bypass (an admin setting), the `v1.7.0` resolution that must
follow it, signing the release commit, and any change to how the version is computed.

## Consequences

### What this buys

A refused branch update can no longer strand a tag: both refs land or neither does,
whether the refusal is a protection rule or a non-fast-forward because a second merge
reached `main` while the release ran. The non-fast-forward case used to strand a tag
exactly as `GH006` did. If the server cannot do an atomic push at all, git aborts on the
client and pushes nothing, so that case fails closed too. The release commit can no
longer carry the SBOM or any other generated file. A premature bump or tag deletion no
longer produces the next orphan: it moves the red from the preflight to the push step, and
nothing is written.

### What this costs

- **An allow-list that has to move with the release.** `push-release.sh` accepts exactly
  `package.json` and `CHANGELOG.md`. A second version file, a renamed changelog, a
  `pre-commit` script handed to the action, or a preset that writes another file would make every
  release fail at the push step until the list is updated with it.
- **The push is ours to maintain.** The action no longer owns it. A future action upgrade
  that changes how `git-push: 'false'` behaves, or stops rewriting `origin`, breaks the
  lane at the push step rather than silently. The workflow Bats pins the input but cannot
  observe the action's internals.
- **No live proof yet.** GitHub still rejects the release commit until an admin applies
  the bypass. Until then every run stops at the preflight, so the atomic push against real
  branch protection is proved only by the local Bats fixture. #481 stays open until the
  first green release run.

### What would reverse it

Publishing the version bump through a pull request and tagging only after it merges, the
alternative ADR 0007 names, would remove the direct push to `main` and this step with it.
If the action ever pushed atomically on its own, the custom step would become redundant,
but the scope check would still be worth keeping.
