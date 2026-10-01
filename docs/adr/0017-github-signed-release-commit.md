# ADR 0017: GitHub signs the release commit, created through the Git Database API

- **Status:** Accepted
- **Date:** 2026-10-01
- **Deciders:** website maintainers
- **Related:** ADR 0007, ADR 0011, ADR 0013, issue #515, issue #517, issue #343,
  [`.github/AUTORELEASE.md`](../../.github/AUTORELEASE.md),
  `.github/workflows/autorelease.yml`, `scripts/ci/sign-release-commit.sh`,
  `scripts/ci/push-release.sh`

## Context

`main` is still under classic branch protection, and that protection requires verified
signatures. The changelog action creates the release commit with a plain `git commit` on
the runner, so the commit is unsigned. Every push to `main` since ADR 0013 computes
`v1.8.0` and then fails at the atomic push. Run 36781166989 (2026-09-30) shows the
refusal:

```text
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Commits must have verified signatures.
remote:   Found 1 violation:
 ! [remote rejected]   HEAD -> main (protected branch hook declined)
 ! [remote rejected]   v1.8.0 -> v1.8.0 (atomic transaction failed)
```

The run on 2026-08-27 was also refused with "Changes must be made through a pull
request". That line is gone now, so signatures are the only rule still refusing the
release. The atomic push from ADR 0011 worked as designed: no `v1.8.0` tag reached the
remote. That made issues #515 and #517 a red lane rather than a corruption.

ADR 0007 named two remedies, and both need an admin. One is a ruleset with a bypass
for the release App, which also means retiring classic protection, because the classic
signed-commit rule has no bypass actor. The other is a signing key held in the repository
secrets. ADR 0007 preferred the ruleset because the key would be one more secret.

There is a third option, and it needs neither. GitHub's "About commit signature
verification" page says:

> Signature verification for bots will only work if the request is verified and
> authenticated as the GitHub App or bot and contains no custom author information,
> custom committer information, and no custom signature information, such as Commits API.

The release workflow already holds an installation token for the release App with
`contents: write`. With that token it can create the same commit through the REST Git
Database API, and GitHub will sign it.

## Decision

We re-create the release commit through the Git Database API with the release App's token,
so GitHub signs it, and push that signed copy in place of the local commit.

- `autorelease.yml` gets a `Sign the release commit through the GitHub API` step between
  the changelog action and the atomic push. The step runs only when the changelog action
  did not skip, and the token and tag reach it through `env:`.
- `scripts/ci/sign-release-commit.sh <tag>` checks every changed path before its first
  API call. Only added or modified regular `100644` files can be re-created this way, so
  a deletion, rename, copy, symlink, submodule or executable bit fails closed. The script
  then works in four steps:
  1. It uploads each file as a blob and checks that the blob SHA GitHub returns matches
     the local one.
  2. It builds a tree on the parent's tree. Git object ids are content hashes, so it
     refuses unless the tree SHA GitHub returns equals the local commit's tree.
  3. It creates the commit with the local message, the same single parent, and no author,
     committer or signature. It refuses unless the response says
     `verification.verified == true`.
  4. It fetches the new commit by SHA. If origin will not serve an unadvertised SHA, it
     rebuilds the same object from the `verification.payload` and
     `verification.signature` the API returned, and accepts it only if it hashes to the
     SHA GitHub reported. It checks the tree, the parent and the `gpgsig` header again
     locally, then moves `HEAD` onto the new commit and re-creates the annotated tag
     there.
- `scripts/ci/push-release.sh` does not change what it checks or how it pushes. It still
  validates the tag, the version and the file scope, and still pushes the branch and the
  tag in one `git push --atomic`. Its refusal message no longer says the bypass is
  missing. It now points at whichever protection rule GH006 names.
- `tests/bats/release_sign.bats` runs the script against a fake Git Database API built
  on a real bare repository, covering both the happy path and every refusal.
  `tests/bats/autorelease_workflow.bats` pins the step's position, guard and inputs.

Out of scope: the `main` ruleset and retiring classic protection, both tracked with #343.
That work still matters for review and status-check enforcement, but the release no
longer waits on it.

## Consequences

### What this buys

A merge can unblock the release lane without any admin action, and no private key is
added to the repository's secrets. A release commit is now verified, and GitHub, not a
self-declared runner identity, attributes it to the App's bot account. The step fails
closed: if GitHub ever stops signing these commits, the run stops at the signing step
with `GitHub did not verify the signature`. Nothing is pushed in that case, and the
refusal names the cause.

### What this costs

- **No proof before merge.** `autorelease.yml` runs only on pushes to `main`, so no pull
  request can run this step against GitHub. The Bats fake shows the script does what it
  intends. Only the first push to `main` after this merge shows that GitHub signs the
  commit and that classic protection accepts it. If the run fails there, the error says
  why and nothing is written.
- **A dependency on documented GitHub behaviour.** The fix relies on bot signing staying
  available for Git Database API commits, and on the API returning the signed payload
  when `git fetch` cannot retrieve an unreferenced commit by its full SHA. If either
  changes, the lane goes red at the signing step again.
- **More API calls on the most privileged path.** Each release now makes one blob call
  per changed file plus one tree call and one commit call. If the run fails after the
  commit call, GitHub keeps an unreferenced commit object that no ref names.
- **The release author changes.** From `v1.8.0` on, the author and committer come from
  the App identity, not from "Conventional Changelog Action". The release-audit ledger
  records this. `docs/release-audit.md` says why.

### What would reverse it

GitHub no longer signing App-created API commits would reverse this: the step would
refuse, and the lane would fall back to ADR 0007's options. So would a decision to stop
pushing to `main` and release through a pull request, which ADR 0007 names.
