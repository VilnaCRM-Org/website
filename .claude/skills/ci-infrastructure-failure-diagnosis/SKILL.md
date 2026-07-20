---
name: ci-infrastructure-failure-diagnosis
description: Use when GitHub Actions sandbox/deploy checks fail across multiple PRs/branches — diagnose whether the failure is code-specific or repo-wide infrastructure. Triggers on "deploy check red", "sandbox failing", "all my PRs failing at deploy", "check-tokens failure", or when troubleshooting CI red flags that affect unrelated branches.
---

# CI Infrastructure Failure Diagnosis

When GitHub Actions checks fail red, especially the `deploy` (sandbox) job, determine whether the failure is caused by:

1. Code in the PR (fix in code)
2. Repo-wide infrastructure (escalate to ops)

This skill covers the `deploy` job in `.github/workflows/sandbox-creating.yml` (the `sandbox` workflow), which historically retrieved the PR number via a GitHub API call using a token stored in AWS Secrets Manager — not `github.token`. (`sandbox-deleting.yml` mirrored the same token retrieval.)

> **Resolved in code (#375).** The sandbox `deploy` job no longer looks up the PR number via that token — it now reads `PR_NUMBER` straight from `${{ github.event.pull_request.number }}`, so an expired `github-token-*` secret can no longer make this check fail. The timeline + cross-branch methodology below still applies to any _other_ shared-infrastructure CI failure.

## Quick diagnostic: timeline + consistency

**Step 1: Check the timeline**

Look at the GitHub Actions run history (repo > Actions > All workflows > deploy).

- When was the last successful sandbox run?
- Did every run since then fail at the same step?

If the last successful run is 3+ days old and every run since then fails at the same step, the failure is **almost certainly infrastructure**, not your code.

Example:

```
Last green: 2026-07-03T13:14:07Z
Today's runs: all red since 2026-07-06T07:37:00Z
→ Timeline cutoff = infrastructure incident
```

**Step 2: Check consistency across branches**

Look at recent runs on **multiple unrelated branches** (main, feat/_, chore/_, ci/\*, etc.).

- Does the same failure happen on all of them at the same step?

If both `feat/328` and `chore/364` fail at "Get PR Number" in the sandbox job, it's not your code — it's a shared resource (token, API, secret).

**Step 3 (historical, pre-#375): the old `deploy` job's "Get PR Number" step**

_This exact failure mode is resolved on the sandbox `deploy` path (see the note above) — it no longer fetches a token or calls the API. Keep the pattern below as a template for diagnosing any *other* job that still pulls a token from Secrets Manager and calls the GitHub API._

The sandbox workflow historically ran an API query to fetch the PR number:

```bash
gh api "repos/VilnaCRM-Org/website/pulls?state=open&head=VilnaCRM-Org:${GITHUB_REF_NAME}" --jq '.[] | .number'
```

It pulled the GitHub token from **AWS Secrets Manager** (not `github.token`). If such a job returns an empty PR number:

1. **Test the query manually** with your own GitHub token:

   ```bash
   gh api "repos/VilnaCRM-Org/website/pulls?state=open&head=VilnaCRM-Org:<your-branch-name>" --jq '.[] | .number'
   ```

   If this returns your PR number, the query is correct and the issue is the stored token.

2. **Check the GitHub Actions logs** for the exact error:
   - Is it "Unauthorized" (401)?
   - Is it "token expired"?
   - Or just empty output?

3. **If the stored token is invalid/expired**, that's the fix: rotate the `github-token-*` secret in AWS Secrets Manager (ops action, not code).

**Signs of an expired token in AWS Secrets Manager:**

- Your API query works with a fresh token, but the workflow gets empty result
- GitHub Actions logs show "401 Unauthorized" or timeout
- Timeline shows a clean cutoff: green runs until date X, then all red
- Affects all branches equally (not just your PR)

## Confirming it's infrastructure (not your code)

Checklist before escalating:

- [ ] Timeline: last green run is 3+ days old ✓
- [ ] Cross-branch: same failure on 2+ unrelated branches ✓
- [ ] Code: the PR contains no infrastructure changes (no workflow edits, no secret refs) ✓
- [ ] Manual test: API query works with your token but workflow fails ✓

If all four are true, it's infrastructure.

## How to file the tracking issue

Example issue title and body:

**Title:** Sandbox `deploy` job: GitHub token in AWS Secrets Manager expired (~2026-07-03)

**Body:**

```
## Symptom
Sandbox `deploy` check fails on all PRs/branches at "Get PR Number" step.

## Evidence
- Last successful sandbox run: 2026-07-03T13:14:07Z (feat/328)
- Every run since 2026-07-06T07:37:00Z fails at same step (feat/328, chore/364, ci/358)
- API query `gh api "repos/VilnaCRM-Org/website/pulls?state=open&head=VilnaCRM-Org:<branch>"` returns PR number with fresh token
- Same query in sandbox job workflow returns empty (stored token invalid)

## Root Cause
GitHub token stored in AWS Secrets Manager (pulled by the `deploy` job in `.github/workflows/sandbox-creating.yml`) is expired or invalid.

## Fix Required (ops)
Rotate `github-token-*` secret in AWS Secrets Manager.

## Timeline Impact
All PRs since 2026-07-03 have red `deploy` checks (regardless of code quality).
```

Include the timeline, branches, and the manual test result — that proves it's infrastructure.

## What NOT to do

- ❌ Do not mask the failing step to force a green check (e.g. `continue-on-error: true`, `|| true`, or `set +e`) — the check is doing its job
- ❌ Do not commit a workaround in code (the issue is not in code)
- ❌ Do not lower the check's required status (the check itself is fine; the secret is broken)
- ❌ Do not assume "re-running will fix it" (re-running uses the same expired token)

## Related

- **Before this step:** See [`ci-workflow`](../ci-workflow/SKILL.md) for pre-commit/pre-PR validation when code changes are made.
- **For code CI failures:** Use `ci-workflow`'s "When a gate fails" section to fix ESLint, TypeScript, Jest, Playwright, etc.
- **For AWS Secrets Manager ops:** Escalate to DevOps / infrastructure team; provide the issue evidence above.
