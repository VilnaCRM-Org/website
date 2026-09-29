# ADR 0013: Main takes the stranded `v1.7.0` release commit before the bypass lands

- **Status:** Accepted
- **Date:** 2026-09-29
- **Deciders:** website maintainers
- **Related:** ADR 0007, ADR 0011, issue #502, issue #481, issue #343,
  [`.github/AUTORELEASE.md`](../../.github/AUTORELEASE.md),
  `scripts/ci/check-release-version.sh`, `scripts/ci/push-release.sh`

## Context

ADR 0007 fixed the remedy for the stranded `v1.7.0` tag in a strict order: an admin
grants the release App a bypass over `main`'s protection **first**, and only then does a
maintainer either delete the tag or advance `package.json` to `1.7.0`. The order existed
because the push was not atomic, so bumping early would strand `v1.8.0` next.

ADR 0011 made the push atomic and said so: an early bump "is no longer dangerous". It kept
the order for one remaining reason — the preflight's failure names the stranded tag, while
a refused push "only reports the refusal".

On 2026-09-29 the bypass was still not in effect. The only ruleset on the repository was
the tag-targeted "Protect release tags", `rules/branches/main` returned no rules, and
classic protection was still enabled on `main`. Every push to `main` kept failing the
preflight (run 36498739881), which the CI-health alerter reported as issue #502.

## Decision

We advance `package.json` to `1.7.0` and take `CHANGELOG.md` byte-for-byte from the tagged
commit `711bbae5` now, without waiting for the bypass.

- The tag is not moved or deleted. It stays an orphan with no GitHub release; the next
  release is `v1.8.0`.
- The commit's third file, `website-sbom.cdx.json`, stays out. It is gitignored since
  ADR 0011.
- `scripts/ci/push-release.sh` now names the likely cause of a refused push: a GH006 in
  git's output means the App has no bypass yet, and the message points at setup step 3 of
  `.github/AUTORELEASE.md`. That removes the diagnostic reason ADR 0011 gave for keeping
  the order.

The bypass itself stays out of scope. It is a repository setting (issue #343).

## Consequences

### What this buys

The admin change alone now unblocks the lane. Once the bypass is in effect, the next push
to `main` ships `v1.8.0` with no follow-up pull request that would otherwise have had to
race other merges. The preflight is green again, so a new stray tag shows up as a fresh
preflight failure instead of hiding behind a check that was already red.

### What this costs

- **The lane stays red, one step later.** Until the bypass lands, every run computes
  `v1.8.0` and fails at `Push the release commit and tag atomically` with GH006. The atomic
  push writes neither ref, so no new orphan appears, but the CI-health alert stays open.
- **Version 1.7.0 is skipped for good.** Deleting the tag and releasing `1.7.0` again, the
  other branch of ADR 0007's remedy, is off the table: `package.json` already carries
  `1.7.0`.
- **The 1.7.0 changelog section is temporary.** The changelog action regenerates
  `CHANGELOG.md` from git on every release, keeping five releases. The action cannot see
  `v1.7.0` from `main`, so the `v1.8.0` entry lists every change since `v0.3.0` and
  replaces the 1.7.0 section.

### What would reverse it

Nothing needs reversing once the first release after the bypass ships. If an admin
chooses signed release commits (ADR 0007's second option) instead of the ruleset, this
decision still holds. Only the name of the setting the push message points at would
change.
