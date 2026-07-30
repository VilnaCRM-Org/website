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
   c. Set the following Repository Permissions:
    - Administration: Read and Write (needed for managing repository settings)
    - Contents: Read and Write (needed for accessing and modifying repository contents)
    - Issues: Read and Write (needed for creating and managing issues)
    - Metadata: Read Only (needed for accessing repository metadata)
    - Pull Requests: Read and Write (needed for creating and managing pull requests)
      d. Check "Install Only on this account".

These settings ensure that the GitHub App has the necessary permissions to automate the release process effectively.

Once you have created the app, you need to install it on the repository you want to use it. Follow GitHub's guide on installing your apps to repositories you own.
One more thing you need to do from the app's settings. Go to the app's settings and generate a new private key. Copy that private key to a safe place and then copy the app ID. You will need both values as repository secrets.
You can easily find ID here(Settings > Application > configure your github APP > app settings > you can see app id). Generate a new private key and copy the app ID. These will be used to authenticate the GitHub Actions workflow with the necessary permissions to perform auto-releases.
#### 2) The GitHub repository configuration
Go to Settings > Secrets and Variables > Actions to create new secrets. Add one secret for the private key(VILNACRM_APP_PRIVATE_KEY) and another for the app ID(VILNACRM_APP_ID).

`VILNACRM_APP_PRIVATE_KEY` must hold the **raw PEM** exactly as GitHub generated it, starting with `-----BEGIN RSA PRIVATE KEY-----`. `actions/create-github-app-token` does not accept a base64-encoded key.
#### 3) Allow force push
To configure the repository branch protection rules, go to Settings > Branches.
Check the option to Allow force pushes and specify that the only allowed actor is the GitHub app you already installed.

---
## What each release produces

Every push to `main` whose commits are release-eligible runs
[`.github/workflows/autorelease.yml`](workflows/autorelease.yml), which:

1. Verifies the next version cannot collide with an existing tag
   (`scripts/ci/check-release-version.sh`).
2. Generates `CHANGELOG.md`, bumps `package.json`, commits `chore(release): vX.Y.Z [skip ci]`, and pushes the tag.
3. Generates a CycloneDX SBOM of the full locked dependency tree with Syft.
4. Publishes the GitHub release with `gh release create` and attaches the SBOM as `website-sbom.cdx.json`.

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
