# Documentation for GitHub Actions Pipelines: Sandbox Creation and Sandbox Deletion

This documentation provides an overview of two GitHub Actions workflows used for managing AWS CodePipeline executions: Sandbox Creation and Sandbox Deletion. It includes instructions on the required secrets and how to add them to your GitHub repository.

## Table of Contents

- [Introduction](#introduction)
- [Prerequisites](#prerequisites)
- [Workflow 1: Sandbox Creation](#workflow-1-sandbox-creation)
  - [Creation and Rebuild Overview](#creation-and-rebuild-overview)
  - [Creation Variables Setup](#creation-variables-setup)
- [Workflow 2: Trigger Sandbox Deletion](#workflow-2-trigger-sandbox-deletion)
  - [Deletion Overview](#deletion-overview)
  - [Deletion Variables Setup](#deletion-variables-setup)
- [AWS IAM Role Configuration](#aws-iam-role-configuration)
  - [Why the subject must be exact, and never a wildcard](#why-the-subject-must-be-exact-and-never-a-wildcard)
    - [Order of operations: trust policy first, `environment:` key second](#order-of-operations-trust-policy-first-environment-key-second)
  - [Production incident: `website-deploy-trigger-role` (issue #494)](#production-incident-website-deploy-trigger-role-issue-494)
- [Verifying sandbox cleanup](#verifying-sandbox-cleanup)
- [Additional Notes](#additional-notes)

## Introduction

The two GitHub Actions workflows automate the process of triggering AWS CodePipeline executions in response to various GitHub events. They leverage GitHub's OpenID Connect (OIDC) feature for secure authentication with AWS and manage both sandbox and production environments.

  Sandbox Management: Handles sandbox creation only when a maintainer adds the
  `deploy-sandbox` label to an open, same-repository pull request. It does not
  rebuild automatically when new commits are pushed; remove and re-add the label
  to request another sandbox execution.
  Trigger Sandbox Deletion: Initiates the deletion of sandbox environments when a pull request is closed on the main branch.

## Prerequisites

  GitHub Repository: Access to the repository where the workflows will be used.
  AWS Account: Permissions to create and manage AWS IAM roles, policies, and AWS CodePipeline pipelines.
  AWS Secrets Manager: Storing and retrieving secrets that might need periodic rotation.
  AWS CodePipeline: Existing pipelines for sandbox creation and deletion, as well as production website deployment.
  GitHub Secrets and Variables: Ability to add and manage repository or organization-level secrets and variables.

## Workflow 1: Sandbox Creation
### Creation and Rebuild Overview

Filename: .github/workflows/sandbox-creating.yml

Triggers:

  pull_request labeled: When a maintainer adds `deploy-sandbox` to an open,
  same-repository pull request, trigger the sandbox creation pipeline. The PR
  number is read directly from the pull_request event payload
  (github.event.pull_request.number); no GitHub token or API lookup is used.

  Re-run behavior: adding any other label, adding `deploy-sandbox` to a closed
  PR, and pushing additional commits do not start the pipeline. To deliberately
  rebuild an open PR sandbox, remove and re-add `deploy-sandbox`.

Token check: before starting the pipeline execution, the check-tokens job reads the expires_at of the GitHub-token secret in AWS Secrets Manager for the test and the production account and logs whether each token exists, has expired, or is missing. It reports only; it rotates nothing and dispatches no event.

Key Points:

  Uses OIDC for secure authentication with AWS.
  Validates required variables.
  Starts AWS CodePipeline execution for sandbox creation or update after handling secret rotation needs.

Additionally, you need to ensure that an AWS_REGION variable is set either at the repository or organization level.

Lifecycle invariant (issue #380): `pull_request` must stay this workflow's only trigger. Every sandbox is billed until the deletion pipeline reclaims it, and that pipeline is only ever started by a pull request closing, so a sandbox created from a bare branch push, a `workflow_dispatch` or a `schedule` has no matching teardown and is orphaned. `make lint-prod-guardrails` (assertion G) fails a pull request that adds any other trigger here (or removes `pull_request`, or lists the `closed` type, which is the deleter's event), or that gives the deletion workflow any trigger other than `pull_request` with `closed` as its only type; it locates both workflows by the pipeline name they start, so renaming the file does not evade it. A reaper for sandboxes whose deletion run failed, and a cap on concurrent sandboxes, belong to the infrastructure repository that owns the pipelines.

### Creation Variables Setup

- Navigate to **Settings > Secrets and variables > Actions > Variables** in your GitHub organization.
- Add the following variables:
  - `TEST_AWS_ACCOUNT_ID`: The ID of the AWS account for token rotation in the test environment.
  - `PROD_AWS_ACCOUNT_ID`: The ID of the AWS account for token rotation in the prod environment.
  - `AWS_REGION`: The region of the AWS account.
  - No GitHub token is needed to obtain the PR number: it is read from the `pull_request` event payload (`github.event.pull_request.number`), and AWS access uses OIDC only.

## Workflow 2: Trigger Sandbox Deletion
### Deletion Overview

Filename: .github/workflows/sandbox-deleting.yml

This workflow triggers the AWS CodePipeline responsible for deleting sandbox environments when a pull request is closed on the main branch.

Key Features:

   Responds only to pull request closures on the main branch.
   Utilizes OIDC for secure authentication with AWS.
   Validates the presence of required secrets and environment variables.

### Deletion Variables Setup

- Navigate to **Settings > Secrets and variables > Actions > Variables** in your GitHub organization.
- Add the following variables:
  - `TEST_AWS_ACCOUNT_ID`: The ID of the AWS account for token rotation in the test environment.
  - `PROD_AWS_ACCOUNT_ID`: The ID of the AWS account for token rotation in the prod environment.
  - `AWS_REGION`: The region of the AWS account.
  - No GitHub token is needed to obtain the PR number: it is read from the `pull_request` event payload (`github.event.pull_request.number`), and AWS access uses OIDC only.

## AWS IAM Role Configuration

Both workflows rely on an AWS IAM role that GitHub Actions assumes via OIDC to interact with AWS services securely. This role must have the necessary permissions and be configured to trust GitHub's OIDC provider.
Steps to Configure the IAM Role

   Create an IAM Role:
       Go to the AWS IAM console.
       Create a new role with the following settings:
           Trusted Entity: Web identity.
           Identity Provider: token.actions.githubusercontent.com.
           Audience: sts.amazonaws.com.

   Set the Trust Policy:

   Update the role's trust relationship with the following policy, replacing placeholders with your
   information. Note the `StringEquals` condition: the subject must be matched **exactly**.

    {
      "Version": "2012-10-17",
      "Statement": [
        {
          "Effect": "Allow",
          "Principal": {
            "Federated": "arn:aws:iam::YOUR_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
          },
          "Action": "sts:AssumeRoleWithWebIdentity",
          "Condition": {
            "StringEquals": {
              "token.actions.githubusercontent.com:sub": "repo:YOUR_GITHUB_ORG/YOUR_REPO:environment:YOUR_ENVIRONMENT_NAME",
              "token.actions.githubusercontent.com:aud": "sts.amazonaws.com"
            }
          }
        }
      ]
    }

   Replace all three placeholders — the subject is matched exactly, so every segment must be
   the literal value the job will mint:
       YOUR_AWS_ACCOUNT_ID with your AWS account number.
       repo:YOUR_GITHUB_ORG/YOUR_REPO with your own GitHub organization and repository.
       YOUR_ENVIRONMENT_NAME with the environment for **this specific role**, taken from its row
       in the role/subject table below. The three sandbox roles use three different environments
       (`sandbox-tokens`, `sandbox`, `sandbox-teardown`); copying one role's environment into
       another's policy mints a subject the policy does not match, and the assume-role call fails.

### Why the subject must be exact, and never a wildcard

Earlier revisions of this document prescribed a `StringLike` condition with the subject
`repo:YOUR_GITHUB_ORG/YOUR_REPO:*`. Do not use it. The `:*` wildcard matches **every** OIDC subject
the repository can mint — `repo:ORG/REPO:ref:refs/heads/<any-branch>`, `repo:ORG/REPO:pull_request`,
and every `repo:ORG/REPO:environment:<any-name>`. Any workflow in the repository that requests
`id-token: write`, on any branch and from any pull request, can therefore assume the
production-account role. A collaborator branch push, a bot, or an automated agent with push
authority reaches production credentials with no review in front of it, and the IAM trust policy —
the last control that could have stopped it — asserts nothing beyond "this repository".

A `StringEquals` subject of the form `repo:VilnaCRM-Org/website:environment:<env>` is minted only
when the job declares `environment: <env>`, which in turn is what lets a maintainer attach required
reviewers and a wait timer to it in repository settings. Branch and pull-request contexts mint a
different subject and are refused by STS outright.

Give each role its own subject rather than sharing one, so a role can only be assumed by the job
that needs it:

| Role | Workflow / job | Exact subject |
| ---- | -------------- | ------------- |
| `github-actions-role` (test and prod, Secrets Manager reads) | `sandbox-creating.yml` / `check-tokens` | `repo:VilnaCRM-Org/website:environment:sandbox-tokens` |
| `sandbox-creation-trigger-role` | `sandbox-creating.yml` / `deploy` | `repo:VilnaCRM-Org/website:environment:sandbox` |
| `sandbox-deletion-trigger-role` | `sandbox-deleting.yml` / `trigger-sandbox-deletion-pipeline` | `repo:VilnaCRM-Org/website:environment:sandbox-teardown` |
| `website-deploy-trigger-role` (prescribed, not deployed — issue #494) | `deploy.yml` / `deploy` | `repo:VilnaCRM-Org/website:environment:production` |

This table is the **prescribed** policy, not a description of what is deployed today. **No
row is deployed — including `website-deploy-trigger-role`.** The three pipeline-trigger roles
in the table (and the infrastructure repository's own `ci-cd-infra-trigger-role`) are built
from one module in the infrastructure repository,
`VilnaCRM-Org/website-infrastructure`
(`terraform/app/modules/aws/iam/oidc/pipeline-trigger-role/main.tf`), whose trust policy
accepts, through a `StringLike` list, only the branch subject
`repo:VilnaCRM-Org/website:ref:refs/heads/*`, the `repo:VilnaCRM-Org/website:pull_request`
subject, and the same two for the infrastructure repository. It accepts neither the `:*`
wildcard this document used to print nor any `environment:` subject. `github-actions-role`
(`terraform/app/modules/aws/iam/roles/github-token-rotation-role/main.tf`) likewise accepts
only branch and pull-request subjects, and refused an environment subject in the run recorded
below. See the order of operations below
before changing either half, and the production incident after it for what happens when a
live role and its Terraform disagree.

### Order of operations: trust policy first, `environment:` key second

> **Do not add an `environment:` key to a role-assuming job before the role's trust policy
> accepts that job's exact environment subject.** Naming an environment does not merely
> label the job — it **changes** the OIDC subject GitHub mints, from
> `repo:VilnaCRM-Org/website:pull_request` to
> `repo:VilnaCRM-Org/website:environment:<name>`. If the trust policy does not accept the new
> subject, every run fails at `sts:AssumeRoleWithWebIdentity`.

Evidence: PR #464 added `environment:` keys to the three sandbox jobs on the stated assumption
that the key was inert until a maintainer created the environments. It was not. The
`check-tokens` job failed immediately with

```text
Could not assume role with OIDC: Not authorized to perform sts:AssumeRoleWithWebIdentity
(12 retries, role arn:aws:iam::891377212104:role/github-actions-role)
```

([run 34385698159](https://github.com/VilnaCRM-Org/website/actions/runs/34385698159/job/102581269340)).
The keys were reverted. That failure is also what proves the deployed policy is narrower than
this document's old template claimed: a genuine `StringLike` `repo:VilnaCRM-Org/website:*`
condition would have matched the new environment subject and the run would have passed.

An earlier revision of this section went on to say that `deploy.yml`'s working
`environment: production` proved the *production* role's policy accepted an environment
subject. It proved only that the **live** role accepted it at that moment — the committed
Terraform never did, and the next apply removed the acceptance. See the production incident
below.

The correct sequence, therefore, is:

1. In the infrastructure repository, update each role's trust policy — in Terraform, never
   in the IAM console, because the next pipeline apply reverts anything that exists only
   outside Terraform — to the
   `StringEquals` exact subject in the table above.
2. Create the matching environments under _Settings → Environments_ and attach their
   protection rules — see [the deployment runbook](../docs/deployment-runbook.md).
3. Only then add the `environment:` key to the corresponding job, and verify the sandbox
   pipeline is green on a pull request.

Because step 3 has not happened, no sandbox job declares an `environment:` today, and no gate
requires one. The production `deploy` job is the exception: it already declares
`environment: production`, `make lint-prod-guardrails` assertion E requires it to, and step 1
is still outstanding for its role — which is why every push-to-`main` deploy is currently red.

Attach Policies to the Role:

   Attach policies that grant the necessary permissions:
       For Sandbox Management:
           codepipeline:StartPipelineExecution on the pipeline specified in AWS_SANDBOX_CODEPIPELINE_NAME.
       For Trigger Sandbox Deletion:
           codepipeline:StartPipelineExecution on the pipeline specified in AWS_SANDBOX_DELETION_PIPELINE_NAME.

   Example Policy:

        {
          "Version": "2012-10-17",
          "Statement": [
            {
              "Effect": "Allow",
              "Action": "codepipeline:StartPipelineExecution",
              "Resource": [
                "arn:aws:codepipeline:YOUR_REGION:YOUR_ACCOUNT_ID:AWS_SANDBOX_CODEPIPELINE_NAME",
                "arn:aws:codepipeline:YOUR_REGION:YOUR_ACCOUNT_ID:AWS_SANDBOX_DELETION_PIPELINE_NAME"
              ]
            }
          ]
        }

   Replace:
      YOUR_REGION with your AWS region (e.g., us-east-1).
      YOUR_ACCOUNT_ID with your AWS account number.
      SANDBOX_MANAGEMENT_PIPELINE_NAME and SANDBOX_DELETION_PIPELINE_NAME with your actual pipeline names.

The `check-tokens` job assumes `github-actions-role` in the test account and then in the
production account (`vars.TEST_AWS_ACCOUNT_ID`, `vars.PROD_AWS_ACCOUNT_ID`). Each of those
roles needs two statements and nothing else: `secretsmanager:ListSecrets` on `"*"` —
AWS does not support resource-level scoping for that action, so a policy that grants it
only on the secret's ARN denies the list call and fails the check — and
`secretsmanager:GetSecretValue` on the GitHub-token secret's ARN alone. No CodePipeline
permission is required for the check.

The secret's JSON carries the GitHub token beside its `expires_at`, so the job pipes
`get-secret-value` straight into `jq` and reads only `expires_at`. The token is never
bound to a shell variable, and therefore never reachable by a later `set -x`, an
environment dump or an errored step's log (issue #375); `make lint-prod-guardrails`
separately fails any step that persists a credential-named variable to `$GITHUB_ENV`
without masking it first.

### Production incident: `website-deploy-trigger-role` (issue #494)

`deploy.yml`'s `deploy` job has declared `environment: production` since PR #326
(`7719643a`, 2026-07-03). The repository uses GitHub's default OIDC subject format, so the job
mints `repo:VilnaCRM-Org/website:environment:production`.

- **Green** through
  [run 35396803405](https://github.com/VilnaCRM-Org/website/actions/runs/35396803405)
  (2026-09-18, `c8f0a755`).
- **Red** from
  [run 35792114048](https://github.com/VilnaCRM-Org/website/actions/runs/35792114048)
  (2026-09-22, `32f3c1ab`) onwards, at the `Configure AWS Credentials` step, with the same
  `Not authorized to perform sts:AssumeRoleWithWebIdentity` error as above. Every push to
  `main` since has failed the same way; the latest at the time of writing is
  [run 36633803887](https://github.com/VilnaCRM-Org/website/actions/runs/36633803887)
  (2026-09-29, `6d0fa987`).

Nothing in this repository changed the job between those runs:
`git diff c8f0a755 32f3c1ab -- .github/workflows/deploy.yml` touches only the post-deploy
smoke-test step, and the `Configure AWS Credentials` step is byte-identical.

The change was in the infrastructure repository. The live acceptance of the environment subject
was **out-of-band drift that the committed Terraform never contained**. The module has never
named an `environment:` subject. Until website-infrastructure #120 (`4513eb42`, 2026-05-09) its
policy was a `StringLike` `repo:VilnaCRM-Org/*` wildcard, which would have matched one; since
then it has been the branch and pull-request subjects above, which match none. Nor was the live
role simply still carrying that pre-#120 wildcard — the public record rules that out:

- On 2026-05-09 a maintainer recorded on #120 that it was "merged and applied in test, but prod
  is still stale/unapplied", and the infrastructure repository's `OIDC trust smoke test`
  ([run 25609393651](https://github.com/VilnaCRM-Org/website-infrastructure/actions/runs/25609393651),
  2026-05-09T19:06Z) failed to assume all four production roles, `website-deploy-trigger-role`
  included, with `Not authorized to perform sts:AssumeRoleWithWebIdentity`. Its caller was
  `repo:VilnaCRM-Org/website-infrastructure:ref:refs/heads/main`, a subject both the pre-#120
  wildcard and the #120 policy accept, so the live `website-deploy-trigger-role` already
  matched neither.
- The daily smoke test stayed red through 2026-05-13
  ([run 25787411030](https://github.com/VilnaCRM-Org/website-infrastructure/actions/runs/25787411030))
  and turned green on 2026-05-14
  ([run 25849759986](https://github.com/VilnaCRM-Org/website-infrastructure/actions/runs/25849759986)),
  with no commit landing on the infrastructure repository's `main` in between.
- From July the production role accepted `repo:VilnaCRM-Org/website:environment:production`,
  which the #120 policy — the only one `main` held from 2026-05-09 until #124 — refuses.

So the live policy that accepted the environment subject from July was set out of band: the
role had left the pre-#120 wildcard by 2026-05-09, and every apply from `main` after that renders
the #120 policy, which refuses the subject. It existed only outside Terraform, which is why it
did not survive an apply.

Website-infrastructure PR #124 (`3f0e3fa2`, merged 2026-09-19T15:26Z) changed the
`ci-cd-infrastructure` stack, and it is the only commit on the infrastructure repository's
`main` between the last green deploy (2026-09-18T21:26Z) and the first red one
(2026-09-22T22:23Z). The production `ci-cd-infrastructure` pipeline runs in CodePipeline, not
in a GitHub workflow, so its apply leaves no run this repository can read — and a merge does not
imply an immediate apply: over an hour after #120 merged, a follow-up comment still reported
production as unapplied. That the apply following #124's merge is the one that converged the
live role back onto the committed policy, and removed the acceptance, is therefore an inference
from that window rather than an observed apply.

The fix is external, in the infrastructure repository, and must land in Terraform:

1. Give the `pipeline-trigger-role` module a **per-role** list of exact subjects (for example
   an `environment_subjects` variable that defaults to empty), and set it for
   `website-deploy-trigger-role` (the `ci_cd_pipeline_role` module call) alone. Setting it in
   the module's shared policy would widen the sandbox and infrastructure roles as well.
2. Render each subject as its **own** statement. Condition keys inside one statement are
   ANDed, so a `StringEquals` `sub` beside the existing `StringLike` `sub` list would demand
   that a subject match both and would lock out every caller:

       {
         "Effect": "Allow",
         "Principal": {
           "Federated": "arn:aws:iam::PROD_AWS_ACCOUNT_ID:oidc-provider/token.actions.githubusercontent.com"
         },
         "Action": "sts:AssumeRoleWithWebIdentity",
         "Condition": {
           "StringEquals": {
             "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
             "token.actions.githubusercontent.com:sub": "repo:VilnaCRM-Org/website:environment:production"
           }
         }
       }

3. Let the `ci-cd-infrastructure` pipeline apply it, then re-run the latest failed `website`
   run on `main` and confirm `Configure AWS Credentials` passes.

Do **not** remove `environment: production` from `deploy.yml` to get green: assertion E of
`make lint-prod-guardrails` requires it on a push-triggered job that assumes a role, and
dropping it removes the environment's protection rules from in front of the production role.

## Verifying sandbox cleanup

These two workflows only start the pipelines. What actually removes a sandbox lives in the
website-infrastructure repository: the `sandbox-deletion` pipeline's `sandbox_deletion.sh` when
a pull request closes, and the `sandbox-cleanup-lambda` function, fired by a one-shot
`sandbox-cleanup-<first 44 characters of the bucket name, dots replaced with dashes>`
EventBridge rule seven days after the latest sandbox deploy. Both workflows assume their
roles in the production account, so this repository's sandboxes are `sandbox-prod-*` buckets
there.

[The sandbox cleanup verification runbook](../docs/runbooks/sandbox-cleanup.md) (issue #148)
is the operator procedure for proving that path works: finding the EventBridge rule for a
sandbox bucket, checking the Lambda execution role with `aws iam simulate-principal-policy`,
running a probe against a throwaway bucket in the test account, reading the Lambda's
CloudWatch logs, and confirming no bucket or rule is left behind. It also records the gaps
visible in the infrastructure source and which repository owns each fix.

## Additional Notes

  Environment Variables:
    The workflows use the AWS_REGION environment variable.
    Set this variable in your repository or organization settings under Variables.
        Name: AWS_REGION
        Value: Your AWS region (e.g., us-east-1).

  OIDC Authentication:
    By using OIDC, you enhance security by avoiding long-lived AWS credentials.
    Ensure that the IAM role's trust policy is correctly configured to allow GitHub Actions to assume the role.
    Subject claim conditions (token.actions.githubusercontent.com:sub) must be matched with StringEquals against the exact environment subject above, never with a StringLike wildcard.

  Workflow File Placement:
    Place the workflow files in the .github/workflows/ directory of your repository.
        sandbox-creating.yml for the Sandbox Creation workflow.
        sandbox-deleting.yml for the Trigger Sandbox Deletion workflow.

  Testing:
    After setting up, test the workflows by opening and closing pull requests to verify that the pipelines are triggered correctly.
    After making changes, test by opening a PR to ensure that the workflow checks and triggers rotation as expected, and then starts the pipeline execution.

  Logging and Monitoring:
    Monitor the GitHub Actions logs for any errors or issues.
    Check AWS CodePipeline execution history for pipeline runs initiated by the workflows.
    Check GitHub Actions logs and AWS CodePipeline execution history for troubleshooting.

  Token expiry:
    The check-tokens job only reports. It compares the secret's expires_at with the current
    time and logs whether the token exists, has expired, or is missing in each account; it
    does not rotate anything and dispatches no event. Rotation is owned by the
    website-infrastructure repository.
