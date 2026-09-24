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

The changelog action ends with `git push origin main --follow-tags`: it pushes
the `chore(release): vX.Y.Z [skip ci]` commit to `main` and the new tag in one
command. `main` is under **classic branch protection** that (a) requires pull
requests and (b) requires signed commits, and the release commit is created by
plain `git commit` on the runner, unsigned. So the push is rejected. Verified
on run [33113478799](https://github.com/VilnaCRM-Org/website/actions/runs/33113478799)
(2026-08-27), the first release attempt after the #366 repair:

```text
remote: error: GH006: Protected branch update failed for refs/heads/main.
remote: - Commits must have verified signatures.
remote:   Found 1 violation: 711bbae59187174b61b98729847112d5999db617
remote: - Changes must be made through a pull request.
 * [new tag]           v1.7.0 -> v1.7.0
 ! [remote rejected]   main -> main (protected branch hook declined)
```

Note the two lines together: the **branch** push was refused, but the **tag**
push in the same command succeeded. The push is not atomic, so every rejected
release strands a tag with no release behind it — see "The version and tag
invariant" below for what that did next.

"Allow force pushes", which this step used to prescribe, is the wrong knob: it
does not bypass the pull-request rule, and classic protection's signed-commit
rule has **no bypass actor at all** — nothing you can grant the App under
_Settings → Branches_ lets an unsigned commit through. A repository admin has
two workable options; either one changes live repository settings, which a
merge alone never does:

1. **Migrate `main` from classic protection to the committed ruleset.** The
   ruleset is already written and reviewed:
   [`config/main-ruleset.json`](../config/main-ruleset.json) keeps "Require a
   pull request before merging" and "Require signed commits" (alongside the
   required status checks and code-owner review of issues #343 and #344), and
   lists the release App as its only bypass actor with the bypass mode
   **Always allow** (`"bypass_mode": "always"`). The other mode, "For pull
   requests only", lets the actor merge a pull request past the rules but not
   push to the branch, and this workflow pushes to `main` directly. Ruleset
   bypass covers every rule in the ruleset, including the signature
   requirement, which is what makes this the option that works without
   touching the workflow. An admin applies it with
   [`scripts/ci/apply-branch-ruleset.sh`](../scripts/ci/apply-branch-ruleset.sh),
   following CONTRIBUTING.md's "The `main` ruleset (issue #343)" runbook:
   - **Dry run first**: `scripts/ci/apply-branch-ruleset.sh --release-app-id <id>`,
     where `<id>` is the release App's ID from its settings page (the value of
     the `VILNACRM_APP_ID` secret). The script refuses to run without it, never
     guesses one, and writes nothing: it prints the payload, the rulesets that
     exist today and the diff between them. Check the bypass actor against the
     App.
   - **Then apply**: re-run it with `--apply`, and verify with
     `gh api repos/VilnaCRM-Org/website/rules/branches/main`.
   - **Then retire classic protection** on `main`, after carrying over anything
     it has that the ruleset lacks through a reviewed change to the config.
     Classic protection's signed-commit rule has no bypass, so while it stays
     in place the release App's push is still rejected, whatever the ruleset
     allows.

   As of 2026-09-24 the only ruleset on the repository is the tag-targeted
   "Protect release tags" (created 2026-09-13), which stops `v*` tags from
   being deleted, updated or force-pushed. It targets tags, not branches, so it does
   not conflict with the `main` ruleset; it does not block the release either,
   because creating a new tag is not one of its rules.

2. **Keep classic protection and make the commit verifiable**: provision a
   signing key for the workflow (an S/MIME or GPG key whose public half is
   registered to the App's bot identity, imported before the changelog action
   runs) _and_ add the App to the pull-request rule's bypass list. Two changes
   instead of one, and the private key becomes a repository secret — prefer
   option 1.

Do **not** relax either rule for everyone: the point of the bypass is that
only the release App's own commit goes around review, and that commit is
generated, not authored.

---

## What each release produces

Every push to `main` whose commits are release-eligible runs
[`.github/workflows/autorelease.yml`](workflows/autorelease.yml), which:

1. Verifies the next version cannot collide with an existing tag
   (`scripts/ci/check-release-version.sh`).
2. Generates `CHANGELOG.md`, bumps `package.json`, commits
   `chore(release): vX.Y.Z [skip ci]`, and pushes the commit and the tag to
   `main` in one non-atomic `git push --follow-tags` (see step 3 above for what
   happens when branch protection refuses the commit).
3. Generates a CycloneDX SBOM of the full locked dependency tree with Syft.
4. Publishes the GitHub release with `gh release create` and attaches the SBOM
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

### Current state: `v1.7.0` is stranded and every run is red

The preflight is doing its job, and that is why the release lane is red today.
The first run after the #366 repair (2026-08-27, run 33113478799) computed
`1.6.0 → 1.7.0`, committed the changelog, tagged `v1.7.0`, and was rejected by
branch protection as described in step 3 above. Because `git push --follow-tags`
is not atomic, the tag landed while the commit did not:

- `refs/tags/v1.7.0` points at `711bbae5`, whose parent `62865e0f` **is** on
  `main` but which itself is not — it is one commit off the branch, with
  `CHANGELOG.md`, the `package.json` bump, and (a second defect) the freshly
  generated `website-sbom.cdx.json` committed into it.
- No GitHub release exists for it; the latest release is still `v0.3.0`
  (2026-01-20).
- `package.json` on `main` still reads `1.6.0`, so every run since fails the
  preflight with `package.json is at 1.6.0 but tag v1.7.0 already exists`.

Unlike the 2025 orphans, this tag was not left by a history rewrite; it was
left by a rejected push. The remedy has a strict order, because bumping the
version or deleting the tag while the push is still rejected simply produces
the next orphan (`v1.8.0`) on the next push to `main`:

1. **First**, a repository admin grants the release App a bypass over both
   protection rules (step 3, option 1).
2. **Then**, a maintainer does exactly one of:
   - delete the stranded tag — `git push --delete origin v1.7.0` — so the next
     release is computed as `v1.7.0` again from a clean slate. The "Protect
     release tags" ruleset forbids deleting a `v*` tag and lists no bypass
     actor, so this path also needs an admin to disable that ruleset for the
     deletion and re-enable it straight after; or
   - advance `package.json` to `1.7.0` on `main` through a normal pull request,
     accepting that `v1.7.0` stays an orphan and the next release is `v1.8.0`.
     This is safe for the changelog range: the action discovers the previous
     tag by walking `git log` from `HEAD`, so a tag that is not an ancestor of
     `main` is invisible to it and the range still starts at `v0.3.0`, the most
     recent tag reachable from `main` — run 33113478799 computed
     `v0.3.0...v1.7.0` for exactly that reason.
3. Watch the next push to `main`: the run should end with a green `Create
   Release` step and a release carrying the SBOM. If the push is rejected
   again, the bypass is not in effect — stop and check the ruleset before any
   further tag or version change.

Never bump `package.json` to make the preflight green while step 1 is still
outstanding, and never delete a tag that has a release behind it.
