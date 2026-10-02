# Autorelease action

## Overview

Auto-release workflows automate the process of creating software releases in response to specific triggers like merging a pull request or pushing to a certain branch. This automation helps streamline the development process, reduce human error, and ensure consistent release practices. In this project, we utilize conventional commits and GitHub Actions to implement our auto-release workflow. Conventional commits provide a standardized format for commit messages, which our GitHub Action uses to automatically determine version bumps and generate changelogs. This combination allows for seamless and consistent releases based on the commit history.

---

## Why You Might Need Auto-Release

Consistency: Automating the release process ensures that every release adheres to predefined standards and procedures, reducing the risk of human error and inconsistency in the release quality.

Efficiency: By automating the changelog generation and release process, teams can save time and focus on development and testing rather than on the operational details of creating a release.

Integration: Auto-release workflows can be integrated with other tools and workflows, such as continuous integration (CI) systems, to ensure that releases are made only when all tests pass, maintaining the quality of the code in the production.

Traceability: Automated releases include detailed logs and changelogs, providing a clear audit trail for changes, which is beneficial for debugging and understanding the project’s history.

Speed: Automation speeds up the process of releasing and deploying software, which is especially crucial in high-paced agile environments where multiple releases might occur in a single day.

---

## Setting Up an Auto-Release Workflow

### Step-by-Step Guide

#### 1) The GitHub App configuration

Let's start by creating and configuring a GitHub App:

1. Go to Settings > Developer Settings > GitHub Apps (Developer Settings is at the bottom of the Settings page).
2. Click on New GitHub App.
3. When configuring the new GitHub app, ensure the following:
   a. Complete the necessary details for the application.
   b. Uncheck the active webhook.
   c. Set the following Repository Permissions — and no others:
    - Contents: Read and Write (the changelog commit, the tag push, and
      `gh release create`)
    - Metadata: Read Only (mandatory for every App)
      d. Check "Install Only on this account".

That is the whole grant [`autorelease.yml`](workflows/autorelease.yml) uses:
its token step requests `permission-contents: write` and nothing else, and no
other workflow authenticates as this App. An earlier revision of this guide also
asked for Administration, Issues and Pull requests read-write; none of them is
exercised by the release path, and an App that can administer the repository is
exactly the supply-chain surface issue #375 (F3c) asked to shrink. If the App
was installed with the wider grant, reduce it under the App's settings — the
installation token cannot exceed what the App holds, so the workflow keeps
working.

Once you have created the app, you need to install it on the repository you want to use it. Follow GitHub's guide on installing your apps to repositories you own.
One more thing you need to do from the app's settings. Go to the app's settings and generate a new private key. Copy that private key to a safe place and then copy the app ID. You will need both values as repository secrets.
You can easily find ID here(Settings > Application > configure your github APP > app settings > you can see app id). Generate a new private key and copy the app ID. These will be used to authenticate the GitHub Actions workflow with the necessary permissions to perform auto-releases.

#### 2) The GitHub repository configuration

Go to Settings > Secrets and Variables > Actions to create new secrets. Add one secret for the private key(VILNACRM_APP_PRIVATE_KEY) and another for the app ID(VILNACRM_APP_ID).

`VILNACRM_APP_PRIVATE_KEY` must hold the **raw PEM** exactly as GitHub generated
it, starting with `-----BEGIN RSA PRIVATE KEY-----`.
`actions/create-github-app-token` does not accept a base64-encoded key.

#### 3) Let the App's release commit reach `main`

`main` is under **classic branch protection**, and that protection requires
signed commits. The changelog action creates the release commit
`chore(release): vX.Y.Z [skip ci]` with a plain `git commit` on the runner, so
that commit is unsigned. The workflow therefore does not push it as it is. It
re-creates the commit through GitHub's Git Database API with the release App's
token, so GitHub signs it, and pushes the signed copy
([ADR 0017](../docs/adr/0017-github-signed-release-commit.md)). This needs no
signing key, no bypass and no admin action. GitHub's documentation, "About
commit signature verification", states the condition:

> Signature verification for bots will only work if the request is verified and
> authenticated as the GitHub App or bot and contains no custom author
> information, custom committer information, and no custom signature
> information, such as Commits API.

`scripts/ci/sign-release-commit.sh` builds the request to meet that condition.
It uploads each changed file as a blob, builds a tree on the parent's tree, and
refuses unless that tree's SHA equals the local commit's tree, which proves the
content is byte-identical. It then creates the commit with the same message and
parent and with no author, committer or signature. It refuses unless GitHub
reports the commit `verified`. Last, it moves `HEAD` and the annotated tag onto
the signed commit. If any check fails, it stops with
`::error::sign-release-commit: …` before anything is pushed.

How the lane got here:

- **Run [33113478799](https://github.com/VilnaCRM-Org/website/actions/runs/33113478799)
  (2026-08-27).** Branch protection refused the unsigned commit for two rules,
  signatures and pull requests. The tag landed anyway, because that push was
  not atomic, and `v1.7.0` was stranded:

  ```text
  remote: - Commits must have verified signatures.
  remote: - Changes must be made through a pull request.
   * [new tag]           v1.7.0 -> v1.7.0
   ! [remote rejected]   main -> main (protected branch hook declined)
  ```

- **Since ADR 0011.** The workflow pushes through `scripts/ci/push-release.sh`
  with `git push --atomic`
  ([ADR 0011](../docs/adr/0011-atomic-release-push.md)). The remote takes the
  branch and the tag together or refuses both, so a rejected release writes
  nothing.

- **Runs 36633803849 (2026-09-29) and 36781166989 (2026-09-30), issues #515
  and #517.** The pull-request rule no longer appears. Signatures were the only
  rule still refusing the push. That is the rule the signing step now satisfies:

  ```text
  remote: - Commits must have verified signatures.
   ! [remote rejected]   HEAD -> main (protected branch hook declined)
   ! [remote rejected]   v1.8.0 -> v1.8.0 (atomic transaction failed)
  ```

The first push to `main` after the signing step merged is the only live proof.
Autorelease never runs on a pull request, so a pull request cannot exercise it.
If that run fails, its error names the step that refused:

- **The signing step** (`GitHub did not verify the signature`, a tree or blob
  mismatch, or a failed API call) means GitHub did not produce an acceptable
  signed copy. Nothing was pushed. Check the `verification.reason` in the
  error before changing anything.
- **The atomic push step with GH006** means the commit was signed but a
  different protection rule refused it. Read the rule GitHub names. If it is
  "Changes must be made through a pull request", the pull-request rule has
  returned, and the release App needs a bypass over it. That bypass is either
  classic protection's "Allow specified actors to bypass required pull
  requests" or the committed ruleset described below.

The signed-commit rule does not need relaxing. Do **not** relax any rule for
everyone.

**The `main` ruleset (issue #343).** It no longer blocks the release, but it is
still the intended protection for `main`.
[`config/main-ruleset.json`](../config/main-ruleset.json) keeps "Require a pull
request before merging" and "Require signed commits", alongside the required
status checks and the code-owner review from issues #343 and #344. It lists the
release App as its only bypass actor, with the bypass mode **Always allow**
(`"bypass_mode": "always"`). The other mode, "For pull requests only", lets the
actor merge a pull request past the rules but not push to the branch, and this
workflow pushes to `main` directly. An admin applies the ruleset with
[`scripts/ci/apply-branch-ruleset.sh`](../scripts/ci/apply-branch-ruleset.sh)
by following steps 1–5 of the CONTRIBUTING.md runbook "The `main` ruleset
(issue #343)". `--release-app-id <id>` is required, and the script does a dry
run until `--apply`. That runbook is the single source for the procedure. As of
2026-10-01 the only ruleset on the repository is the tag-targeted "Protect
release tags". It stops release tags matching `v*` or `[0-9]*` from being
deleted, updated or force-pushed. Creating a new tag is not one of its rules,
so it does not block a release.

---

## What each release produces

Every push to `main` whose commits are release-eligible runs
[`.github/workflows/autorelease.yml`](workflows/autorelease.yml), which:

1. Verifies the next version cannot collide with an existing tag
   (`scripts/ci/check-release-version.sh`).
2. Generates a CycloneDX SBOM of the full locked dependency tree with Syft, and
   fails if it lists implausibly few components.
3. Generates `CHANGELOG.md`, bumps `package.json`, commits
   `chore(release): vX.Y.Z [skip ci]` and tags it `vX.Y.Z` — locally only; the
   changelog action no longer pushes. The SBOM and the release notes are
   gitignored, so the action's `git add .` cannot sweep them into the commit.
4. Re-creates that commit through the Git Database API with the release App's
   token, so GitHub signs it, and moves `HEAD` and the tag onto the signed copy
   (`scripts/ci/sign-release-commit.sh`). It refuses unless GitHub's tree
   matches the local tree byte for byte and GitHub reports the commit
   `verified`. A deletion, rename, symlink or executable bit in the release
   commit fails it before any API call.
5. Pushes the commit and the tag to `main` in one `git push --atomic`
   (`scripts/ci/push-release.sh`). First it checks that the tag names the
   commit, that `package.json` carries the tag's version, and that the commit
   changes only `package.json` and `CHANGELOG.md`. If branch protection refuses
   the commit, it refuses the tag with it (see setup step 3, "Let the App's
   release commit reach `main`").
6. Publishes the GitHub release with `gh release create` and attaches the SBOM
   as `website-sbom.cdx.json`.

To answer "did release X ship the vulnerable package?":

```bash
gh release download vX.Y.Z --pattern 'website-sbom.cdx.json'
jq -r '.components[] | "\(.name)@\(.version)"' website-sbom.cdx.json | grep '<package>'
```

The SBOM step is a hard step. If Syft cannot read `bun.lock`, or the resulting
document lists implausibly few components, the release fails rather than
publishing an inventory that is silently empty.

---

## The version and tag invariant

The changelog action derives the next version by bumping the `version` field in
`package.json`, then runs `git tag -a v<next>`. If a tag already exists at that
version, `git tag` aborts with exit 128 — **after** the changelog has already
been committed — and the release dies half-finished.

That is what happened between 2026-01-20 and the repair in issue #366: a history
rewrite left `v0.3.1` and `v0.4.0` on the remote pointing at commits that are
not ancestors of `main`, while `package.json` stayed at `0.3.0`. Eight
consecutive runs failed on `fatal: tag 'v0.4.0' already exists` and no release
shipped.

So the repository holds one invariant:

> The `version` in `package.json` must be at least as high as every existing tag.

`scripts/ci/check-release-version.sh` enforces it as the first real step of the
workflow, so a violation fails immediately with a remedy instead of corrupting a
release. If it fires, either advance `package.json` to the highest existing tag
or reconcile the stray tags with the maintainers. Do not weaken the check.

The decision behind the invariant — raise `package.json` to the highest tag and
add the preflight, rather than delete the orphan tags — is recorded in
[ADR 0007](../docs/adr/0007-release-automation-and-tag-invariant.md), together
with which tags sit on `main` and which do not.

### Current state: `v1.8.0` waits for the first signed run

As of 2026-10-01: `package.json` on `main` reads `1.7.0`. The latest GitHub
release is still `v0.3.0` (2026-01-20). The remote has no `v1.8.0` tag, and the
newest tag is the orphan `v1.7.0`. The atomic push did its job: every refused
run wrote neither ref.

How `v1.7.0` was stranded and reconciled:

- The first run after the #366 repair (2026-08-27, run 33113478799) computed
  `1.6.0 → 1.7.0`, committed the changelog and tagged `v1.7.0`. Branch
  protection rejected it, as setup step 3 describes. That
  `git push --follow-tags` was not atomic, so the tag landed and the commit
  did not.
- `refs/tags/v1.7.0` points at `711bbae5`. Its parent `62865e0f` **is** on
  `main`, but `711bbae5` itself is not: it sits one commit off the branch, with
  `CHANGELOG.md`, the `package.json` bump, and a second defect, the freshly
  generated `website-sbom.cdx.json`, committed into it. No GitHub release
  exists for it.
- Until issue #502, every run failed the preflight with `package.json is at
  1.6.0 but tag v1.7.0 already exists`. Issue #502 reconciled `main` with that
  commit ([ADR 0013](../docs/adr/0013-reconcile-stranded-v1-7-0-before-the-bypass.md)):
  `package.json` reads `1.7.0`, and `CHANGELOG.md` is byte-identical to the
  tagged commit's. The SBOM stays out, because it is gitignored now.

From then on, every run passed the preflight, computed `v1.8.0`, and failed at
the atomic push with GH006 "Commits must have verified signatures"
(runs 36633803849 and 36781166989, issues #515 and #517). Setup step 3 now
signs the release commit through the Git Database API
([ADR 0017](../docs/adr/0017-github-signed-release-commit.md)), so no admin
change is needed before the next release.

The changelog range is unaffected. The action finds the previous tag by walking
`git log` from `HEAD`. A tag that is not an ancestor of `main` is invisible to
it, so the range still starts at `v0.3.0`, the most recent tag reachable from
`main`. Run 33113478799 computed `v0.3.0...v1.7.0` for exactly that reason.
The action also regenerates `CHANGELOG.md` from git on every release, keeping
five releases. The `v1.8.0` entry will therefore list every change since
`v0.3.0` and replace today's 1.7.0 section, which describes a release that never
shipped.

Watch the first push to `main` after the signing step merges. It should end
with a green `Create Release` step and a `v1.8.0` release carrying the SBOM,
and `main` should hold a verified `chore(release): v1.8.0` commit. If that run
fails, read which step failed (see the end of setup step 3). Neither step writes
a ref on failure, so stop and diagnose before any tag or version change.

Leave `v1.7.0` in place. It no longer blocks anything, and the "Protect release
tags" ruleset refuses its deletion anyway. Never delete a tag that has a release
behind it.
