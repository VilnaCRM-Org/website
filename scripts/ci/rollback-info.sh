#!/usr/bin/env bash
# Print the last SUCCESSFUL production deployment: commit SHA, ref, timestamp
# and the run that performed it (issue #329). Run by `make rollback-info`.
#
# SOURCE OF TRUTH -- the GitHub Deployments API. deploy.yml's `deploy` job runs
# inside the `production` GitHub Environment, so every push to main records a
# Deployment (sha + ref) whose statuses GitHub writes as the job runs:
# `in_progress`, then `success` or `failure`. It is the only per-commit deploy
# record this repository produces, and it needs no AWS access to read.
#
# HONEST LIMIT -- `success` here means the deploy JOB succeeded, i.e. the
# CodePipeline execution was TRIGGERED: the job does not wait for the pipeline
# (ADR 0001, "deploys are fire-and-forget"), and the post-deploy smoke job is
# skipped until PRODUCTION_SITE_URL is set. So this is "the last commit handed
# to the pipeline", not "the last commit proved live". The runbook says the
# same; do not read more into the output than that.
#
# Read-only by construction: the only calls are `gh auth status` and `gh api`
# GETs. Exit codes are distinct so a caller can tell the cases apart:
#   0  a successful deployment was found and printed
#   2  gh is not installed
#   3  gh is not authenticated
#   4  no deployment reached state `success` (or none exists at all)
#   5  the API could not be read
#
# Requires: gh (authenticated) and jq.
set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
ENVIRONMENT="${ROLLBACK_ENVIRONMENT:-production}"
# Newest first; a run of this many consecutive failed deploys with no green
# one behind it is itself the finding, so the window is deliberately small.
LIMIT="${ROLLBACK_DEPLOYMENTS_LIMIT:-20}"

fail() {
  local code="$1"
  shift
  printf 'rollback-info: %s\n' "$*" >&2
  exit "$code"
}

command -v gh >/dev/null 2>&1 ||
  fail 2 "gh is not installed; install the GitHub CLI and run 'gh auth login'"
gh auth status >/dev/null 2>&1 ||
  fail 3 "gh is not authenticated; run 'gh auth login' or export GH_TOKEN"

# `{owner}/{repo}` is expanded by gh from the current checkout's remote when no
# repository is given explicitly, which is what a developer running this from
# a clone wants; CI passes GITHUB_REPOSITORY so no checkout is needed there.
if [ -n "$REPO" ]; then
  base="repos/$REPO"
else
  base='repos/{owner}/{repo}'
fi

if ! deployments="$(gh api "$base/deployments?environment=${ENVIRONMENT}&per_page=${LIMIT}" 2>&1)"; then
  fail 5 "could not list deployments for environment '${ENVIRONMENT}': ${deployments}"
fi

count="$(printf '%s' "$deployments" | jq 'length')"
if [ "$count" -eq 0 ]; then
  fail 4 "no deployment is recorded for environment '${ENVIRONMENT}'; deploy.yml records one per push to main once it has run"
fi

# Deployments arrive newest first; the first one carrying a `success` status is
# the answer. A deployment whose job failed has only `in_progress` + `failure`
# statuses and is skipped, which is the whole point: the newest deployment is
# usually the one being rolled back.
while IFS=$'\t' read -r id sha ref; do
  [ -n "$id" ] || continue
  if ! statuses="$(gh api "$base/deployments/${id}/statuses" 2>&1)"; then
    fail 5 "could not read the statuses of deployment ${id}: ${statuses}"
  fi
  success="$(printf '%s' "$statuses" |
    jq -r 'map(select(.state == "success")) | .[0]
      | if . == null then empty
        else "\(.created_at)\t\(.log_url // .target_url // "n/a")" end')"
  [ -n "$success" ] || continue
  deployed_at="${success%%$'\t'*}"
  run_url="${success#*$'\t'}"
  printf 'Last successful %s deployment (deployment %s)\n' "$ENVIRONMENT" "$id"
  printf '  commit:   %s\n' "$sha"
  printf '  ref:      %s\n' "$ref"
  printf '  deployed: %s\n' "$deployed_at"
  printf '  run:      %s\n' "$run_url"
  printf '\n'
  printf '%s\n' "success = the deploy job finished triggering CodePipeline; the pipeline result and the live site are not verified by this record (docs/deployment-runbook.md, Rollback procedure)."
  exit 0
done < <(printf '%s' "$deployments" | jq -r '.[] | "\(.id)\t\(.sha)\t\(.ref)"')

fail 4 "none of the ${count} most recent '${ENVIRONMENT}' deployment(s) reached state success; widen ROLLBACK_DEPLOYMENTS_LIMIT or check the deploy workflow"
