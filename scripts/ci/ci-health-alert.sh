#!/usr/bin/env bash
# Post-merge CI health alerts (#365): file or refresh a `ci-alert` issue when a
# monitored workflow fails on main or the default branch is red, and close it
# on recovery. Run by .github/workflows/ci-health-alerts.yml.
#
# WHY A SCRIPT -- the logic used to live inline in the workflow, and for the
# first ~100 runs it never delivered: the job had no checkout and no repository
# context, so every `gh issue|label|run` call aborted with gh's "not a
# repository" error before anything was filed (93 failures, 6
# cancelled, 1 vacuous success; no `ci-alert` issue was ever opened, while the
# release lane it monitors had been red on every push since 2026-08-27). Nothing
# could catch that at PR time because nothing could run the inline block. As a
# script it is driven end to end by tests/bats/ci_health_alerts.bats against a
# stubbed `gh`, and the workflow's `workflow_dispatch` dry run exercises the real
# API from a branch without writing anything (issues #325, #329, #331). The
# script itself never touches version control -- its only writes are the issue
# mutations below -- and the bats suite pins that.
#
# REPOSITORY CONTEXT -- gh resolves the target repository from the GH_REPO
# environment variable when no `--repo` is given. It is exported ONCE here, from
# GH_REPO or the GITHUB_REPOSITORY the runner always sets, so a call added later
# cannot forget it; the workflow also sets GH_REPO at job level. The bats suite
# asserts every recorded gh invocation ran with it exported.
#
# Modes (ALERT_EVENT):
#   failure   a monitored run failed or timed out -- file/refresh the alert
#             (WORKFLOW_NAME and RUN_URL required)
#   recovery  a monitored run succeeded -- close the alert if the LATEST run of
#             that workflow on main is green (WORKFLOW_NAME required)
#   sweep     daily red-default-branch check over main's check-runs
#
# ALERT_DRY_RUN=1 performs no write at all: no label, no issue, no comment, no
# close. Reads still happen, so a dry run proves the repository context and the
# token really work.
#
# Requires: gh (authenticated through GH_TOKEN) and jq.
set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
if [ -z "$REPO" ]; then
  echo "ci-health-alert: GH_REPO or GITHUB_REPOSITORY must be set" >&2
  exit 2
fi
export GH_REPO="$REPO"

EVENT="${ALERT_EVENT:-}"
DRY_RUN="${ALERT_DRY_RUN:-0}"
LABEL="${ALERT_LABEL:-ci-alert}"
WORKFLOW_NAME="${WORKFLOW_NAME:-}"
RUN_URL="${RUN_URL:-}"
SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

note() { printf '%s\n' "$*" >&2; }

# The decision each run took, on stdout and in the job summary, so a dry run
# from a branch is readable from the Actions UI without opening the log.
record() {
  printf '%s\n' "$*"
  printf -- '- %s\n' "$*" >>"$SUMMARY"
}

ensure_label() {
  # A dry run must be READ-ONLY end to end, and label creation is a write.
  if [ "$DRY_RUN" = '1' ]; then
    return 0
  fi
  # Idempotent: gh issue create resolves every --label against the repo and
  # errors on an unknown one, and the label is only otherwise repo metadata.
  gh label create "$LABEL" --color B60205 \
    --description 'Deploy/release/red-main CI health alerts' >/dev/null 2>&1 || true
}

# Number of the open alert carrying EXACTLY this title, or empty. `--search
# ... in:title` is a fuzzy word match, so the exact filter is what stops the
# red-main sweep absorbing a per-workflow alert (or vice versa). The title is
# built from a workflow name, so it reaches jq as DATA via --arg, never spliced
# into the program.
find_open_alert() {
  gh issue list --label "$LABEL" --state open --search "$1 in:title" \
    --json number,title |
    jq -r --arg t "$1" 'map(select(.title == $t)) | .[0].number // empty'
}

# $1 title, $2 open issue number or empty, $3 refresh comment, $4 new-issue body.
refresh_or_file() {
  local title="$1" existing="$2" comment="$3" body="$4"
  if [ "$DRY_RUN" = '1' ]; then
    if [ -n "$existing" ]; then
      record "dry run -- would comment on #${existing}: ${comment}"
    else
      record "dry run -- would create '${title}': ${body}"
    fi
    return 0
  fi
  ensure_label
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body "$comment" >/dev/null
    record "commented on #${existing}"
  else
    gh issue create --label "$LABEL" --title "$title" --body "$body" >/dev/null
    record "created '${title}'"
  fi
}

# $1 issue number, $2 closing comment.
close_alert() {
  local existing="$1" comment="$2"
  if [ "$DRY_RUN" = '1' ]; then
    record "dry run -- would close #${existing}: ${comment}"
    return 0
  fi
  gh issue comment "$existing" --body "$comment" >/dev/null
  gh issue close "$existing" >/dev/null
  record "closed #${existing}"
}

# A failed code scan is only actionable with the findings attached. The
# predicate mirrors scripts/ci/code-scanning-gate.sh (security severity
# critical/high, or rule severity error); tests/bats/security_workflows.bats
# pins the pair against drift. Failing to read is not fatal -- the issue is
# still worth filing with just the run link -- hence the `|| true` at the call.
code_scanning_digest() {
  gh api -X GET "repos/$REPO/code-scanning/alerts" \
    -f ref=refs/heads/main -f state=open -f tool_name=CodeQL \
    -F per_page=100 --paginate --jq '
      .[]
      | (.rule.security_severity_level // "" | ascii_downcase) as $sec
      | (.rule.severity // "" | ascii_downcase) as $sev
      | select($sec == "critical" or $sec == "high" or $sev == "error")
      | (if $sec == "" then $sev else $sec end) as $label
      | (.most_recent_instance.location.path // "n/a") as $path
      | "- [\($label)] \(.rule.id) in \($path) — \(.html_url)"
    '
}

require_workflow_name() {
  if [ -z "$WORKFLOW_NAME" ]; then
    note "ci-health-alert: WORKFLOW_NAME must be set for ALERT_EVENT=${EVENT}"
    exit 2
  fi
}

handle_failure() {
  require_workflow_name
  local title="CI health: '$WORKFLOW_NAME' workflow is failing"
  local digest="" suffix="" existing
  if [ "$WORKFLOW_NAME" = "security testing" ]; then
    digest="$(code_scanning_digest || true)"
  fi
  # Empty for every other monitored workflow, so their message bodies are
  # byte-identical to before the digest existed.
  if [ -n "$digest" ]; then
    suffix="$(printf '\n\nOpen blocking code-scanning alerts on main:\n\n%s' "$digest")"
  fi
  existing="$(find_open_alert "$title")"
  refresh_or_file "$title" "$existing" \
    "Still failing: ${RUN_URL}${suffix}" \
    "The '$WORKFLOW_NAME' workflow failed. Latest run: ${RUN_URL}${suffix}"
}

handle_recovery() {
  require_workflow_name
  local title="CI health: '$WORKFLOW_NAME' workflow is failing" existing latest
  existing="$(find_open_alert "$title")"
  if [ -z "$existing" ]; then
    record "no open alert for '${WORKFLOW_NAME}'; nothing to close"
    return 0
  fi
  # Guard against an out-of-order (stale) success event closing an issue a
  # newer failed run opened: close only if the LATEST run of this workflow on
  # main is itself successful.
  latest="$(gh run list --workflow "$WORKFLOW_NAME" --branch main --limit 1 \
    --json conclusion --jq '.[0].conclusion')"
  if [ "$latest" != "success" ]; then
    record "latest '${WORKFLOW_NAME}' run on main is '${latest}', not success; #${existing} stays open"
    return 0
  fi
  close_alert "$existing" \
    "Recovered: '$WORKFLOW_NAME' is green again (latest main run succeeded). Closing."
}

# Daily approximation of the "main red > 24h" signal: the sweep runs once a day
# and refreshes (comments on) the same issue rather than duplicating, so a
# persistently red main keeps one open issue that auto-closes on the first
# fully-green sweep.
handle_sweep() {
  local sha runs failed incomplete title existing commit_url
  sha="$(gh api "repos/$REPO/commits/main" --jq '.sha')"
  # per_page=100 captures every check-run for the commit in one page (this repo
  # has well under 100). failed = any completed run whose conclusion is not a
  # healthy one (success/neutral/skipped) -- this catches cancelled /
  # action_required / stale / timed_out, not only failure. incomplete = still
  # queued or in progress (no conclusion yet).
  runs="$(gh api "repos/$REPO/commits/$sha/check-runs?per_page=100")"
  failed="$(printf '%s' "$runs" | jq '[.check_runs[]
    | select(.status == "completed"
      and .conclusion != "success"
      and .conclusion != "neutral"
      and .conclusion != "skipped")] | length')"
  incomplete="$(printf '%s' "$runs" | jq '[.check_runs[]
    | select(.status != "completed")] | length')"
  title='CI health: main is red'
  existing="$(find_open_alert "$title")"
  commit_url="$SERVER_URL/$REPO/commit/$sha"
  record "main at ${sha}: ${failed} failing, ${incomplete} incomplete check-run(s)"
  if [ "$failed" -gt 0 ]; then
    refresh_or_file "$title" "$existing" \
      "main still red at $sha ($failed failing check-run(s)): $commit_url" \
      "The default branch has $failed failing check-run(s) at $sha: $commit_url"
  elif [ "$incomplete" -eq 0 ] && [ -n "$existing" ]; then
    # Close only once every check-run has completed and none is red -- a commit
    # whose checks are still running is not "recovered".
    close_alert "$existing" "main is green again at $sha. Closing."
  else
    record "nothing to file or close"
  fi
}

case "$EVENT" in
  failure) handle_failure ;;
  recovery) handle_recovery ;;
  sweep) handle_sweep ;;
  *)
    note "ci-health-alert: ALERT_EVENT must be failure|recovery|sweep (got '${EVENT}')"
    exit 2
    ;;
esac
