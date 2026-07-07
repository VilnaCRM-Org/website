---
name: ci-infrastructure-failure-diagnosis
description: Use when a GitHub Actions check fails intermittently or consistently — sandbox deploy, code scanning, or other infrastructure-dependent jobs. Covers diagnosis methodology (timeline analysis, cross-branch consistency, trigger guards, OIDC/token verification) and common failure patterns in this repo's CI.
---

# CI Infrastructure Failure Diagnosis

Diagnosing GitHub Actions CI check failures when the root cause is not obvious — permission issues, race conditions, expired credentials, or misconfigured triggers.

## Common Failure Patterns

### Sandbox Deploy Check Failures

The sandbox `deploy` PR check (from `sandbox-creating.yml`, NOT `deploy.yml`) provisions AWS sandbox environments via CodePipeline. It can fail for:

1. **Push-vs-PR race condition** (historical, pre-#375)
   - Symptom: job dies at `aws codepipeline start-pipeline-execution` with `ParamValidation` error (exit 252)
   - Cause: workflow fired on both branch `push` (with empty `PR_NUMBER`) and `pull_request` event; the push run failed while pull_request passed
   - Fix: Remove `push` triggers; keep only `pull_request: [opened, reopened, synchronize]`

2. **Expired Secrets-Manager token** (historical, pre-#375)
   - Symptom: "PR number extraction failed" on every re-run; API call to `GET /pulls?head=...` returns empty
   - Cause: "Get PR Number" step pulled a token from AWS Secrets Manager (not `github.token`); token expired, token rotation was pending
   - Fix: Read `PR_NUMBER` directly from `${{ github.event.pull_request.number }}` (no API call, no token dependency)

3. **OIDC token or AWS role misconfiguration**
   - Symptom: `configure-aws-credentials` fails with auth errors; permission denied on `aws codepipeline start-pipeline-execution`
   - Cause: job permissions are missing `id-token: write`; AWS role trust policy doesn't include the GitHub OIDC provider; role session mismatch
   - Fix: Ensure job has `permissions: id-token: write` only; verify AWS role trust policy includes OpenID Connect provider; pin `aws-actions/configure-aws-credentials` to SHA

4. **Fork PR guard missing**
   - Symptom: fork PRs trigger sandbox creation (wasteful, security concern)
   - Cause: workflow lacks same-repo check
   - Fix: Add `if: github.event.pull_request.head.repo.full_name == github.repository` to production-account jobs

## Diagnosis Methodology

When a PR check fails, follow this sequence:

### Step 1: Gather Timeline & Logs

1. Open the failed workflow run in GitHub Actions UI.
2. Note the **exact timestamp** and **branch/PR number**.
3. Capture the **full error message** and **exit code**:
   - AWS errors (e.g., `ParamValidation exit 252`, auth failures)
   - GitHub API errors (e.g., `401 Unauthorized`, `empty response`)
   - Script errors (e.g., missing env var, validation fail)
4. Check for warnings or upstream job failures.

### Step 2: Check Workflow Triggers

1. Review the workflow file's `on:` section.
2. Verify it fires only on the expected event type(s).
   - Sandbox deploy: should be `pull_request: [opened, reopened, synchronize]` only.
   - Main deploy: should be `push: branches: [main]` only.
3. Look for unintended `push` / `pull_request` / `schedule` triggers that could race.
4. Confirm no `if:` conditions accidentally suppress the job.

### Step 3: Cross-Branch Consistency

1. Does the same PR fail on multiple pushes / re-runs? → Persistent config issue.
2. Does it pass on one branch but fail on another? → Check branch protection rules, environment variables, or fork vs. upstream.
3. Does it only fail on fork PRs? → Missing same-repo guard; add `if: github.event.pull_request.head.repo.full_name == github.repository`.

### Step 4: Verify Environment Variables & Credentials

1. In the failed run, expand each step and check **all `env:` output**.
2. Verify expected variables are set:
   - `AWS_REGION`, `PROD_AWS_ACCOUNT_ID`, `BRANCH_NAME`, `PR_NUMBER` — are they non-empty?
   - Confirm `PR_NUMBER` is read from `${{ github.event.pull_request.number }}`, not from API.
3. Check permissions block in the job:
   - OIDC jobs need `permissions: id-token: write` (and nothing else, to minimize blast radius).
   - Smoke-test / read-only jobs need `permissions: contents: read` only.
4. If using AWS OIDC:
   - Verify `aws-actions/configure-aws-credentials` is SHA-pinned and called with correct `role-to-assume`, `role-session-name`, and `aws-region`.
   - Confirm the IAM role exists and trust policy includes GitHub OIDC provider.
5. If pulling secrets from AWS Secrets Manager:
   - Check the secret exists and hasn't expired (see `check-tokens` job in `sandbox-creating.yml`).
   - Verify the current AWS role has permission to list/read the secret.

### Step 5: Check Upstream Jobs & Concurrency

1. If the job `needs: [other-job]`, verify the upstream job passed.
2. Check the `concurrency` block for accidental cancellation:
   - Should be `cancel-in-progress: false` for production jobs (aborting a pipeline trigger mid-run is unsafe).
   - Sandbox jobs should serialize per PR: `group: ${{ github.workflow }}-${{ github.event.pull_request.number || github.ref }}`.

### Step 6: Consult Memory & Sister Repo

- Related memory: [[website-deploy-check-push-vs-pr]], [[website-pr-review-bots]], [[crm-sister-repo-ci-gate-reference]].
- If diagnosing a similar workflow in the CRM repo, check its `sandbox-creating.yml` / `deploy.yml` — it is the reference implementation for this pattern.

## Fix Patterns

### For Sandbox Deploy (PR Check)

**File:** `.github/workflows/sandbox-creating.yml`

- ✅ Triggers: `pull_request: [opened, reopened, synchronize]` only (no push).
- ✅ Job permissions: `permissions: id-token: write` for prod-account jobs.
- ✅ Fork guard: `if: github.event.pull_request.head.repo.full_name == github.repository`.
- ✅ PR number source: `PR_NUMBER: ${{ github.event.pull_request.number }}` (env var, direct from event).
- ✅ Environment variables: Validated in the "Validate environment variables" step (all non-null, non-empty).
- ✅ AWS role: `configure-aws-credentials` SHA-pinned, `role-session-name` includes "OIDC" for audit.
- ✅ Secrets rotation check: `check-tokens` job verifies AWS Secrets Manager tokens exist and haven't expired.

### For Main Deploy (Push Check)

**File:** `.github/workflows/deploy.yml`

- ✅ Triggers: `push: branches: [main]` only.
- ✅ Job permissions: `permissions: id-token: write, contents: read`.
- ✅ AWS role: `configure-aws-credentials` SHA-pinned, `role-session-name` includes "OIDC".
- ✅ No Secrets Manager dependency; OIDC handles all auth.
- ✅ Concurrency: `cancel-in-progress: false` (do not abort in-flight production triggers).
- ✅ Environment gate: job runs in the `production` environment (requires protection rules from Settings).

## Prevention Checklist

Before pushing a new or modified CI workflow:

- [ ] Workflow triggers are explicit and non-overlapping (no push + pull_request race).
- [ ] Job permissions are minimal (OIDC jobs get `id-token: write` only; others get `contents: read`).
- [ ] Production-account jobs have fork guard: `if: github.event.pull_request.head.repo.full_name == github.repository`.
- [ ] Environment variables (PR_NUMBER, BRANCH_NAME, AWS_REGION, etc.) are read directly from event payload, not from API calls.
- [ ] AWS role is SHA-pinned and trust policy includes GitHub OIDC provider.
- [ ] Concurrency is set correctly: production jobs use `cancel-in-progress: false`; sandbox jobs serialize per PR.
- [ ] Smoke tests and other downstream jobs have explicit `if:` guards (e.g., `if: ${{ vars.PRODUCTION_SITE_URL != '' }}`).

## Related Skills & References

- [[architecture]] — repo structure and module boundaries.
- [[ci-workflow]] — pre-commit/pre-PR local validation (format, test, lint).
- [[hardening-github-actions-permissions]] — general GitHub Actions permissions best practices.
- Memory: [[website-deploy-check-push-vs-pr]], [[crm-sister-repo-ci-gate-reference]].
