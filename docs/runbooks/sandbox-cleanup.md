# Sandbox cleanup verification runbook

How an operator with AWS access proves that a pull-request sandbox is actually torn down: the
EventBridge rule fires the cleanup Lambda, the Lambda is allowed to do its job, its logs show a
clean run, and no bucket or rule is left behind (issue #148). Every step is a read, except the
probe in [step 3](#3-trigger-a-test-run-on-a-throwaway-bucket), which creates and destroys
its own throwaway bucket and rule in the **test** account.

None of the cleanup code lives in this repository. Every resource name below was read from
[VilnaCRM-Org/website-infrastructure][infra] at commit `3f0e3fa2` (2026-09-19); if a command
reports a name that does not exist, re-read the linked source before assuming the sandbox is
broken.

## Contents

- [How a sandbox is removed](#how-a-sandbox-is-removed)
- [Names you will query](#names-you-will-query)
- [0. Set up the shell](#0-set-up-the-shell)
- [1. The EventBridge rule is wired to the Lambda](#1-the-eventbridge-rule-is-wired-to-the-lambda)
- [2. The execution role can delete the bucket](#2-the-execution-role-can-delete-the-bucket)
- [3. Trigger a test run on a throwaway bucket](#3-trigger-a-test-run-on-a-throwaway-bucket)
- [4. Read the CloudWatch logs](#4-read-the-cloudwatch-logs)
- [5. Confirm nothing is left behind](#5-confirm-nothing-is-left-behind)
- [Gaps visible in the source](#gaps-visible-in-the-source)
- [Who owns a fix](#who-owns-a-fix)

Issue #148's tasks map onto those steps: rule set-up is step 1, role permissions step 2, the
manual trigger step 3, CloudWatch logs step 4 and the residual-bucket check step 5.

## How a sandbox is removed

There are two independent paths, and a sandbox only needs one of them to succeed.

1. **Pull request closed.** [`sandbox-deleting.yml`](../../.github/workflows/sandbox-deleting.yml)
   starts the `sandbox-deletion` CodePipeline, whose build runs [`delete.yml`][delete-yml] and
   then [`sandbox_deletion.sh`][deletion-sh]. When `head-bucket` finds the bucket, that script
   deletes the cleanup rule, empties and deletes the bucket, and fails unless `head-bucket`
   then reports the bucket gone. When the bucket is already gone it touches nothing, **not even
   the rule**, so a rule whose bucket the Lambda already deleted is never removed by closing
   the pull request. It also tries the legacy, pre-hash bucket name
   (website-infrastructure#116).
2. **Seven days after the latest deploy.** Every sandbox deploy
   ([`deploy.yml`][deploy-yml], started through
   [`sandbox-creating.yml`](../../.github/workflows/sandbox-creating.yml)) syncs the export into
   the bucket and runs [`create_eventbridge_rule.sh`][rule-sh]. That script puts a **one-shot**
   `cron(M H D Mo ? YYYY)` rule seven days out — every later push moves it — whose single
   target is the `sandbox-cleanup-lambda` function. When it fires, [the handler][handler]
   empties and deletes the bucket, removes the rule's targets and deletes the rule.

This repository owns only the two trigger workflows. `make lint-prod-guardrails` (assertion G)
holds their symmetry: the creator runs on `pull_request` only, the deleter on `pull_request`
`closed` only. See [the sandbox workflow notes](../../.github/sandbox_workflows.md).

## Names you will query

- **Account:** this repository's
  [`sandbox-creating.yml`](../../.github/workflows/sandbox-creating.yml) and
  [`sandbox-deleting.yml`](../../.github/workflows/sandbox-deleting.yml) assume
  `sandbox-creation-trigger-role` and `sandbox-deletion-trigger-role` in the **production**
  account (`vars.PROD_AWS_ACCOUNT_ID`), so every website pull-request sandbox is a
  `sandbox-prod-*` bucket there. `sandbox-test-*` sandboxes come only from the infrastructure
  repository's own test-account pipelines. Checking a website sandbox in the test account
  finds no rule and no bucket, which reads as a clean teardown when nothing was checked.
- **Region:** `eu-central-1` (`region` in the ci-cd stack's [`base.tfvars`][ci-base-tfvars]).
- **Project name:** `sandbox-test` in the test account, `sandbox-prod` in production
  (`sandbox_project_name` in the stack's `test.tfvars` / `prod.tfvars`). CodeBuild receives it
  as `PROJECT_NAME`.
- **Not a sandbox:** `<PROJECT_NAME>-codepipeline-artifacts-bucket` is the sandbox-creation
  pipeline's own Terraform-managed artifact bucket
  ([`modules/aws/s3/codepipeline/main.tf`][artifacts-tf], instantiated by
  [`sandbox_creation.tf`][creation-tf]). It matches the `<PROJECT_NAME>-` prefix and sits inside
  the cleanup Lambda's `arn:aws:s3:::sandbox-*` delete scope, so the listings below exclude it
  by name. Never empty or delete it.
- **Bucket:** `<PROJECT_NAME>-<BRANCH_NAME>`, where [`sanitize_branch.sh`][sanitize-sh] rewrites
  `BRANCH_NAME` to `<slug prefix>-<first 8 hex of sha1(raw branch)>`, capped so the bucket name
  fits in 63 characters. Example from website-infrastructure#116:
  `sandbox-test-137-refactor-sandbox-deleting-54601b72`.
- **Cleanup rule:** `sandbox-cleanup-<bucket name, dots turned into dashes, first 44 chars>`.
  The script and the handler both derive it this way.
- **Rule target:** one target with a random four-digit `Id`, `Arn`
  `arn:aws:lambda:<region>:<account>:function:sandbox-cleanup-lambda`, and an
  `InputTransformer` whose `InputTemplate` is `{ "bucket_name": "<bucket>" }`.
- **Lambda:** `sandbox-cleanup-lambda`, handler `sandbox_cleanup.lambda_handler`, runtime
  `python3.12`, timeout 300 s, 256 MB ([`lambda.tf`][lambda-tf]).
- **Lambda resource policy:** statement `AllowEventBridgeInvokeSandboxCleanup`, principal
  `events.amazonaws.com`, `AWS:SourceArn` like
  `arn:aws:events:<region>:<account>:rule/sandbox-cleanup-*` (added by the rule script).
- **Execution role:** `sandbox-cleanup-function-role`, with the managed policy
  `sandbox-cleanup-function-policy` rendered from [`data_lambda.tf`][data-lambda-tf].
- **Log group:** `/aws/lambda/sandbox-cleanup-lambda`.
- **Event the handler reads:** `{"bucket_name": "<bucket>"}` and nothing else.

## 0. Set up the shell

Authenticate to the **production** account for a website pull-request sandbox (see
[the account note](#names-you-will-query)), then export the shared values. The AWS CLI and
`jq` are the only tools required. Steps 0 to 2, 4 and 5 only read, apart from the
hand-removal of an orphaned rule at the end of step 5; step 3 sets its own test-account
prefix.

```bash
export AWS_REGION=eu-central-1
export PROJECT_NAME=sandbox-prod   # sandbox-test only for the infrastructure repo's sandboxes
account_id=$(aws sts get-caller-identity --query Account --output text)
artifacts_bucket="${PROJECT_NAME}-codepipeline-artifacts-bucket"
```

Find the bucket for a pull request. Either list the sandboxes that exist:

```bash
aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, '${PROJECT_NAME}-') && Name != '${artifacts_bucket}'].Name" \
  --output text | tr '\t' '\n'
```

or derive the exact name from the branch with the infrastructure repository's own script, run
from a checkout of it:

```bash
derive='. ./aws/scripts/sh/sanitize_branch.sh >/dev/null
printf "%s-%s" "$PROJECT_NAME" "$BRANCH_NAME"'
IFS= read -r -p 'Raw branch name: ' raw_branch
bucket=$(BRANCH_NAME="$raw_branch" sh -c "$derive")
```

Then derive the rule name exactly as the rule script does:

```bash
rule="sandbox-cleanup-$(printf '%s' "$bucket" | sed 's/\./-/g' | cut -c1-44)"
echo "$bucket -> $rule"
```

## 1. The EventBridge rule is wired to the Lambda

The rule must exist, be enabled and carry a schedule roughly seven days after the latest
sandbox deploy:

```bash
aws events describe-rule --name "$rule" \
  --query '{State:State,Schedule:ScheduleExpression,Arn:Arn}'
```

Expect `State` `ENABLED` and a `cron(M H D Mo ? YYYY)` expression in UTC. Its one target must
be the cleanup Lambda and must name **this** bucket:

```bash
aws events list-targets-by-rule --rule "$rule" \
  --query 'Targets[].{Id:Id,Arn:Arn,Input:InputTransformer.InputTemplate}'
```

Expect exactly one target, `Arn` ending in `:function:sandbox-cleanup-lambda`, and an
`InputTemplate` whose `bucket_name` equals `$bucket`. A different bucket there is the
rule-name collision described under [gaps](#gaps-visible-in-the-source).

EventBridge may only invoke the function if the resource policy lets it:

```bash
aws lambda get-policy --function-name sandbox-cleanup-lambda --query Policy --output text |
  jq '.Statement[] | select(.Sid == "AllowEventBridgeInvokeSandboxCleanup")
      | {Principal, Action, SourceArn: .Condition.ArnLike."AWS:SourceArn"}'
```

Expect principal `events.amazonaws.com`, action `lambda:InvokeFunction` and source
`arn:aws:events:eu-central-1:<account>:rule/sandbox-cleanup-*`. A statement id starting
`AllowEventBridgeInvoke-sandbox-cleanup-` is a legacy per-rule grant the script removes on its
next run.

Once a rule has fired, its delivery is visible in the `AWS/Events` metrics even after the
handler deleted it:

```bash
for metric in Invocations FailedInvocations; do
  aws cloudwatch get-metric-statistics --namespace AWS/Events --metric-name "$metric" \
    --dimensions Name=RuleName,Value="$rule" --statistics Sum --period 3600 \
    --start-time "$(date -u -d '-8 days' +%Y-%m-%dT%H:%M:%SZ)" \
    --end-time "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --query "Datapoints[].Sum"
done
```

`Invocations` above zero with `FailedInvocations` empty proves the trigger reached the Lambda.
It does not prove the Lambda succeeded — see step 4. (`date -d` is GNU; on macOS use
`date -u -v-8d`.)

## 2. The execution role can delete the bucket

Confirm the deployed function is the one the source describes:

```bash
aws lambda get-function-configuration --function-name sandbox-cleanup-lambda \
  --query '{Role:Role,Handler:Handler,Runtime:Runtime,Timeout:Timeout,Memory:MemorySize}'
role_arn="arn:aws:iam::${account_id}:role/sandbox-cleanup-function-role"
```

Then ask IAM to evaluate every call the handler makes, against the resources it makes them on.
`simulate-principal-policy` only reads policy; it touches no bucket or rule.

```bash
simulate() {
  aws iam simulate-principal-policy --policy-source-arn "$role_arn" \
    --action-names "$1" --resource-arns "$2" \
    --query 'EvaluationResults[].[EvalActionName,EvalResourceName,EvalDecision]' --output text
}
simulate s3:ListBucket "arn:aws:s3:::${bucket}"
simulate s3:DeleteBucket "arn:aws:s3:::${bucket}"
simulate s3:ListBucketVersions "arn:aws:s3:::${bucket}"
simulate s3:DeleteObject "arn:aws:s3:::${bucket}/index.html"
simulate s3:DeleteObjectVersion "arn:aws:s3:::${bucket}/index.html"
simulate events:ListRules '*'
simulate events:ListTargetsByRule "arn:aws:events:${AWS_REGION}:${account_id}:rule/${rule}"
simulate events:RemoveTargets "arn:aws:events:${AWS_REGION}:${account_id}:rule/${rule}"
simulate events:DeleteRule "arn:aws:events:${AWS_REGION}:${account_id}:rule/${rule}"
```

Expect `allowed` on every line except two. `events:ListRules` is covered below.
`s3:DeleteObjectVersion` reads `implicitDeny`: the policy does not grant it and the handler
never deletes object versions. That is safe only while sandbox buckets stay unversioned —
[`sandbox_creation.sh`][creation-sh] never enables versioning, and this should print nothing:

```bash
aws s3api get-bucket-versioning --bucket "$bucket"
```

`events:ListRules` is simulated against `*`, not against the rule, on purpose. The action
defines no resource type in the EventBridge service authorization reference, while
`ListTargetsByRule`, `RemoveTargets` and `DeleteRule` are scoped to a rule, so AWS authorizes
the handler's `list_rules()` call against `*`. A simulation against the rule ARN matches the
policy's `rule/*` statement and reads `allowed` whatever the real call does; it is not a valid
check for this action. At `3f0e3fa2` the `*` line is expected to read `implicitDeny`, because
the policy grants `ListRules` only on `rule/*` (see [gaps](#gaps-visible-in-the-source)). That
decision means the handler cannot look up its rule: every run deletes the bucket, then fails
and leaves the rule behind.

The S3 statement is scoped to `arn:aws:s3:::sandbox-*`, so a bucket whose name does not start
`sandbox-` is outside it by design. The simulator is a model; the probe in step 3 is the
proof. Where a denial surfaces in the logs depends on the call: an `AccessDenied` on an S3
call, `ListRules` or `ListTargetsByRule` logs `General error: …`, while one on `RemoveTargets`
or `DeleteRule` logs `Error removing targets from rule: …` or `Error deleting rule: …`. The
filter pattern in [step 4](#4-read-the-cloudwatch-logs) matches all three.

## 3. Trigger a test run on a throwaway bucket

Run this in the **test** account only, and never against a real sandbox bucket: the handler
deletes whatever bucket the event names. Re-authenticate to the test account and re-run step
0's `account_id` line first. The probe bucket's `sandbox-test-cleanup-probe-` prefix is fixed
rather than built from `$PROJECT_NAME`, so a shell still set up for production cannot produce
a `sandbox-prod-` probe. It starts `sandbox-` so the execution role's scope covers it, and its
name is short enough that the rule name contains it whole.

```bash
account_id=$(aws sts get-caller-identity --query Account --output text)
probe_bucket="sandbox-test-cleanup-probe-$(date -u +%Y%m%d%H%M)"
probe_rule="sandbox-cleanup-$(printf '%s' "$probe_bucket" | sed 's/\./-/g' | cut -c1-44)"
aws s3api create-bucket --bucket "$probe_bucket" \
  --create-bucket-configuration LocationConstraint="$AWS_REGION"
printf 'probe\n' | aws s3 cp - "s3://${probe_bucket}/index.html"
printf 'probe\n' | aws s3 cp - "s3://${probe_bucket}/_next/static/probe.js"
```

Create the rule the way [`create_eventbridge_rule.sh`][rule-sh] does — same name template,
one-shot cron, same target shape — but five minutes out instead of seven days. The existing
wildcard resource policy already covers any `sandbox-cleanup-*` rule.

```bash
fire_at=$(date -u -d '+5 minutes' +'%M %H %d %m ? %Y')   # macOS: date -u -v+5M
aws events put-rule --name "$probe_rule" --schedule-expression "cron(${fire_at})" \
  --state ENABLED
targets=$(jq -nc \
  --arg arn "arn:aws:lambda:${AWS_REGION}:${account_id}:function:sandbox-cleanup-lambda" \
  --arg bucket "$probe_bucket" \
  '[{Id: "probe", Arn: $arn,
     InputTransformer: {InputPathsMap: {}, InputTemplate: ({bucket_name: $bucket} | tojson)}}]')
aws events put-targets --rule "$probe_rule" --targets "$targets"
```

Wait six minutes, then go to steps 4 and 5 with `bucket=$probe_bucket` and `rule=$probe_rule`.
That exercises the whole EventBridge path.

To exercise the Lambda alone — for example to retest a handler fix without waiting — invoke it
directly with the same event. Create the probe bucket and rule first either way: without the
rule the handler deletes the bucket and then answers 404.

```bash
aws lambda invoke --function-name sandbox-cleanup-lambda \
  --cli-binary-format raw-in-base64-out \
  --payload "$(jq -nc --arg bucket "$probe_bucket" '{bucket_name: $bucket}')" \
  cleanup-response.json
jq . cleanup-response.json
```

The CLI prints `"StatusCode": 200` whenever the function ran, **even when the handler failed**:
every exception is caught and returned as a payload. Judge the run by the payload's
`statusCode`:

- `200` — `Bucket <bucket> deleted. EventBridge rule removed.`
- `400` — the event had no `bucket_name`; nothing was touched.
- `404` — the rule was not found. The bucket **was** already deleted by then.
- `500` — `Error: …`, `Error removing targets: …` or `Error deleting rule: …`; the bucket or
  the rule, or both, may remain.

A `500` whose body — and whose `General error` line in step 4's logs — says `not authorized to
perform: events:ListRules` confirms the `ListRules` gap from step 2. It is not a probe setup
error: the bucket is gone and the rule is left, so remove the rule with the commands below.

If a probe fails part-way, remove what is left by hand, which is what
[`sandbox_deletion.sh`][deletion-sh] does:

```bash
aws events remove-targets --rule "$probe_rule" --ids probe
aws events delete-rule --name "$probe_rule"
aws s3 rm "s3://${probe_bucket}" --recursive
aws s3api delete-bucket --bucket "$probe_bucket"
```

## 4. Read the CloudWatch logs

```bash
aws logs tail /aws/lambda/sandbox-cleanup-lambda --since 30m --format short
```

A clean run prints these lines, in this order, from the handler's `print` calls:

```text
Listing objects in bucket: <bucket>
Deleted objects from <bucket>
Deleted bucket: <bucket>
Fetching all available rules...
Fetching targets for rule: <rule>
Found targets to remove: ['<id>']
Removed targets from rule: <rule>
Attempting to delete rule: <rule>
Deleted rule: <rule>
```

`Deleted objects from` is absent when the bucket was already empty. Search a longer window for
the handler's failure lines rather than relying on the `AWS/Lambda` `Errors` metric, which
stays at zero because the handler returns its errors instead of raising them:

```bash
pattern='?"General error" ?"Error removing targets" ?"Error deleting rule"'
pattern="${pattern} ?\"not found in EventBridge\""
aws logs filter-log-events --log-group-name /aws/lambda/sandbox-cleanup-lambda \
  --start-time "$(( ($(date +%s) - 8 * 86400) * 1000 ))" --filter-pattern "$pattern" \
  --query 'events[].message' --output text
```

Empty output means no cleanup run in the last eight days reported a failure.

## 5. Confirm nothing is left behind

The bucket must be gone:

```bash
aws s3api head-bucket --bucket "$bucket"
```

Expect a non-zero exit with `Not Found` (404). A `Forbidden` (403) means a bucket of that name
exists that you may not read: usually one in some **other** account, since bucket names are
global, but check you hold `s3:ListBucket` in this one before ruling out a residual sandbox.

The rule must be gone as well:

```bash
aws events list-rules --name-prefix "$rule" --query 'Rules[].Name' --output text
```

Expect empty output. A rule still present after its schedule passed means the run failed after
the bucket step; check step 4.

To sweep the whole account for strays — sandboxes with no expiry, and rules pointing at
buckets that no longer exist — run both loops. Both only read.

```bash
aws s3api list-buckets \
  --query "Buckets[?starts_with(Name, '${PROJECT_NAME}-') && Name != '${artifacts_bucket}'].Name" \
  --output text |
  tr '\t' '\n' | while read -r b; do
    r="sandbox-cleanup-$(printf '%s' "$b" | sed 's/\./-/g' | cut -c1-44)"
    aws events describe-rule --name "$r" >/dev/null 2>&1 || echo "no cleanup rule: $b"
  done

aws events list-rules --name-prefix sandbox-cleanup- --query 'Rules[].Name' --output text |
  tr '\t' '\n' | while read -r r; do
    template=$(aws events list-targets-by-rule --rule "$r" \
      --query 'Targets[0].InputTransformer.InputTemplate' --output text)
    b=$(printf '%s' "$template" | jq -r '.bucket_name' 2>/dev/null)
    if [ -z "$b" ]; then echo "rule without a bucket target: $r"; continue; fi
    aws s3api head-bucket --bucket "$b" 2>/dev/null || echo "rule for a missing bucket: $r ($b)"
  done
```

A bucket with no rule is only removed when its pull request closes. A rule for a missing
bucket whose schedule is still ahead will fire and log `General error` (`NoSuchBucket`); one
whose schedule has passed never fires again and stays until removed by hand. Closing the pull
request does not remove it either (see [How a sandbox is removed](#how-a-sandbox-is-removed)).
Remove it with:

```bash
r='<rule name the sweep printed>'
ids=$(aws events list-targets-by-rule --rule "$r" --query 'Targets[].Id' --output text)
[ -n "$ids" ] && aws events remove-targets --rule "$r" --ids $ids
aws events delete-rule --name "$r"
```

## Gaps visible in the source

These follow from the code as written at `3f0e3fa2`. They are recorded so an operator reading
an odd result knows where to look, not as confirmed incidents; each is for the infrastructure
repository to fix.

- **`ListRules` is granted on the wrong resource.** The `AllowEventBridgeListRules` statement
  in `data_lambda.tf` grants `events:ListRules` on
  `arn:aws:events:${var.region}:${local.account_id}:rule/*`, but `ListRules` supports no
  resource-level permissions: the call is authorized against `*`, which that resource does not
  match. The handler would then fail every run right after deleting the bucket, log
  `General error: … not authorized to perform: events:ListRules`, return 500 and leave the
  rule. Step 2's `*` simulation shows it and step 3's probe proves it. The fix is either
  `resources = ["*"]` on that statement, or replacing the handler's `list_rules` lookup with
  `describe_rule(Name=rule_name)`, which is rule-scoped — the policy would then need
  `events:DescribeRule` on `rule/sandbox-cleanup-*`, which it does not grant today.
- **One page of objects.** The handler calls `list_objects_v2` once, which returns at most
  1,000 keys, and then `delete_bucket`. The deploy syncs with `aws s3 sync` and no `--delete`,
  so every push leaves the previous build's hashed chunks behind. A bucket past 1,000 objects
  keeps its remainder, `DeleteBucket` fails with `BucketNotEmpty`, and the run returns 500.
  Count a sandbox's objects with
  `aws s3 ls "s3://$bucket" --recursive --summarize | tail -n 2`.
- **One page of rules.** Once `ListRules` is authorized, the handler looks for its rule in a
  single `ListRules` call with no `NamePrefix` and no pagination. If the rule is not on that
  first page it returns 404 — after the bucket is already deleted — and the rule stays.
  Nothing reclaims it afterwards: closing the pull request skips the rule once the bucket is
  gone, and a past-dated one-shot rule never fires again. Step 5's sweep finds it.
- **Truncated rule names can collide.** The rule keeps the first 44 characters of the bucket
  name. With a 12-character project name the branch hash survives in the rule name only while
  the branch slug prefix is 22 characters or shorter. Beyond that, two sandboxes whose bucket
  names share their first 44 characters — two long branch names with a common 31-character
  slug prefix, say — get the same rule. The website-infrastructure#116 example bucket above
  already maps to `sandbox-cleanup-sandbox-test-137-refactor-sandbox-deleting-5`, its hash cut
  to one character. The later deploy replaces the earlier sandbox's target, so the earlier
  sandbox loses its expiry, and closing either pull request deletes the rule both relied on.
  Step 1's target check shows it.
- **Failures are return values.** The handler catches every exception and returns
  `statusCode` 500, so the invocation succeeds as far as Lambda and EventBridge are concerned:
  no `Errors` or `FailedInvocations` datapoint and no retry. The log search in step 4 is the
  only signal.
- **Two module instances.** Both [`sandbox_creation.tf`][creation-tf] and
  [`sandbox_deletion.tf`][deletion-tf] instantiate `modules/aws/codepipeline/sandbox`, whose
  `lambda.tf` declares the function, role and policy under literal names with no `count`.
  Confirm which instance owns them in that stack's Terraform state before changing either.

## Who owns a fix

- **[website-infrastructure][infra]** owns everything that deletes: the handler, the rule
  script, the execution role and its policy, the deletion script, the buildspecs and the
  Terraform. File cleanup defects there; website-infrastructure#116 (legacy bucket names) and
  website-infrastructure#118 (prod deletion role scope) are the precedents.
- **This repository** owns only when the two pipelines start —
  [`sandbox-creating.yml`](../../.github/workflows/sandbox-creating.yml),
  [`sandbox-deleting.yml`](../../.github/workflows/sandbox-deleting.yml) and assertion G of
  `make lint-prod-guardrails`. No change here can repair a cleanup run.

[infra]: https://github.com/VilnaCRM-Org/website-infrastructure
[handler]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/lambda/python/sandbox_cleanup.py
[rule-sh]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/scripts/sh/create_eventbridge_rule.sh
[deletion-sh]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/scripts/sh/sandbox_deletion.sh
[creation-sh]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/scripts/sh/sandbox_creation.sh
[sanitize-sh]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/scripts/sh/sanitize_branch.sh
[delete-yml]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/buildspecs/sandbox/delete.yml
[deploy-yml]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/aws/buildspecs/sandbox/deploy.yml
[lambda-tf]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/modules/aws/codepipeline/sandbox/lambda.tf
[data-lambda-tf]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/modules/aws/codepipeline/sandbox/data_lambda.tf
[creation-tf]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/stacks/ci-cd-infrastructure/sandbox_creation.tf
[artifacts-tf]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/modules/aws/s3/codepipeline/main.tf
[deletion-tf]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/stacks/ci-cd-infrastructure/sandbox_deletion.tf
[ci-base-tfvars]: https://github.com/VilnaCRM-Org/website-infrastructure/blob/3f0e3fa27d95c4a69027ea6908900cf4cb488183/terraform/app/stacks/ci-cd-infrastructure/tfvars/base.tfvars
