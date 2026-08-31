#!/usr/bin/env bash
# Fail the run on NEW blocking code-scanning alerts (issue #383).
#
# `security-testing.yml` uploads CodeQL results and stops there, so the analyze
# job is green whether CodeQL found zero alerts or fifty. GitHub's own "CodeQL"
# check run does gate a pull request, but that behaviour lives entirely in
# repository settings and is invisible in the diff. This is the in-repo backstop:
# it re-derives the same verdict from the code-scanning REST API so the rule is
# reviewable, and so a push / scheduled run on the default branch fails -- which
# is what routes the finding to ci-health-alerts.yml.
#
# Blocking = rule.security_severity_level in {critical, high}
#            OR rule.severity == "error"   (GitHub's default check-failure set).
#
# On a pull request the alert set for refs/pull/<n>/merge is diffed against the
# alert set for the default branch by alert `number` (a code-scanning alert is a
# repository-level entity, so an inherited finding carries the same number on
# both refs), which keeps pre-existing debt on main from failing somebody else's
# pull request. On the default branch there is no baseline to subtract, so every
# open blocking alert fails the run.
set -euo pipefail

: "${GH_TOKEN:?GH_TOKEN is required}"
REPO="${GH_REPO:?GH_REPO is required}"
EVENT_NAME="${EVENT_NAME:?EVENT_NAME is required}"
ANALYSIS_SHA="${ANALYSIS_SHA:?ANALYSIS_SHA is required}"
DEFAULT_BRANCH="${DEFAULT_BRANCH:-main}"
# Bounded poll. Injectable so the bats suite runs instantly (POLL_DELAY=0) and so
# a slow GitHub day can be absorbed by raising the ceiling in the workflow rather
# than by removing the failure.
POLL_ATTEMPTS="${POLL_ATTEMPTS:-12}"
POLL_DELAY="${POLL_DELAY:-10}"
STEP_SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

# Kept in sync by hand with the digest filter in .github/workflows/ci-health-alerts.yml;
# tests/bats/security_workflows.bats pins the pair against drift.
# A quoted heredoc, so $sec / $sev reach jq unexpanded without the shell ever
# seeing them as parameters. `read -d ''` consumes the whole filter and reports
# EOF, hence the `|| true`.
IFS= read -r -d '' JQ_BLOCKING <<'JQ_FILTER' || true
  .[]
  | (.rule.security_severity_level // "" | ascii_downcase) as $sec
  | (.rule.severity // "" | ascii_downcase) as $sev
  | select($sec == "critical" or $sec == "high" or $sev == "error")
  | [ (.number | tostring),
      (if $sec == "" then $sev else $sec end),
      (.rule.id // "unknown"),
      (.most_recent_instance.location.path // "n/a"),
      (.html_url // "n/a") ]
  | @tsv
JQ_FILTER

notice() { printf '::notice::%s\n' "$1"; }
fail() { printf '::error::%s\n' "$1" >&2; }

# --- 1. Fork pull requests degrade to a notice --------------------------------
# A pull request from a fork runs with a GITHUB_TOKEN whose write scopes are
# downgraded to read, so this backstop cannot reliably read the code-scanning
# API. Skip rather than red an external contributor on a permission error;
# GitHub's native "CodeQL" check run still reports on the pull request.
if [ "$EVENT_NAME" = "pull_request" ] && [ "${HEAD_REPO:-$REPO}" != "$REPO" ]; then
  notice "Code-scanning gate skipped: pull request from fork ${HEAD_REPO:-unknown}."
  exit 0
fi

# --- 2. Resolve the analysed ref and its baseline -----------------------------
if [ "$EVENT_NAME" = "pull_request" ]; then
  : "${PR_NUMBER:?PR_NUMBER is required for pull_request events}"
  ref="refs/pull/${PR_NUMBER}/merge"
  base_ref="refs/heads/${DEFAULT_BRANCH}"
else
  ref="refs/heads/${DEFAULT_BRANCH}"
  base_ref=""
fi

# The codeql-action stamps either the merge commit (github.sha) or the pull
# request head sha onto the analysis; accept either rather than guess.
accepted_shas=("$ANALYSIS_SHA")
if [ -n "${HEAD_SHA:-}" ] && [ "$HEAD_SHA" != "$ANALYSIS_SHA" ]; then
  accepted_shas+=("$HEAD_SHA")
fi

analysis_ready() {
  local shas sha
  shas="$(gh api -X GET "repos/${REPO}/code-scanning/analyses" \
    -f ref="$ref" -f tool_name=CodeQL -F per_page=100 \
    --jq '.[].commit_sha' 2>/dev/null || true)"
  for sha in "${accepted_shas[@]}"; do
    # Plain string matching rather than `grep -q`: under `set -o pipefail` a grep
    # that exits early can SIGPIPE the writer and poison the pipeline status.
    case $'\n'"${shas}"$'\n' in
      *$'\n'"${sha}"$'\n'*) return 0 ;;
    esac
  done
  return 1
}

# --- 3. Bounded wait for the analysis to become queryable ---------------------
# github/codeql-action/analyze defaults `wait-for-processing: true`, so the SARIF
# is already processed when this runs; the poll only absorbs read-after-write lag
# on the alerts API. It is bounded at POLL_ATTEMPTS x POLL_DELAY and then FAILS --
# a gate that passes when it cannot read the data is not a gate.
attempt=1
while [ "$attempt" -le "$POLL_ATTEMPTS" ]; do
  if analysis_ready; then
    break
  fi
  if [ "$attempt" -eq "$POLL_ATTEMPTS" ]; then
    fail "No CodeQL analysis for ${ref} at ${ANALYSIS_SHA} after $((POLL_ATTEMPTS * POLL_DELAY))s."
    exit 1
  fi
  printf 'Waiting for the CodeQL analysis of %s (attempt %s/%s)...\n' \
    "$ref" "$attempt" "$POLL_ATTEMPTS"
  sleep "$POLL_DELAY"
  attempt=$((attempt + 1))
done

# --- 4. Collect blocking alerts for the ref and its baseline ------------------
# `-X GET` with -f/-F puts the fields in the URL-ENCODED query string, which
# matters because refs/pull/<n>/merge contains slashes.
blocking_alerts() {
  gh api -X GET "repos/${REPO}/code-scanning/alerts" \
    -f ref="$1" -f state=open -f tool_name=CodeQL -F per_page=100 --paginate \
    --jq "$JQ_BLOCKING"
}

work_dir="$(mktemp -d)"
trap 'rm -rf "$work_dir"' EXIT
head_file="${work_dir}/head.tsv"
base_file="${work_dir}/base.tsv"
new_file="${work_dir}/new.tsv"

blocking_alerts "$ref" >"$head_file"
if [ -n "$base_ref" ]; then
  blocking_alerts "$base_ref" >"$base_file"
else
  : >"$base_file"
fi

# Keyed on FILENAME rather than the NR==FNR idiom, so an empty baseline file
# cannot cause the head file itself to be read as the baseline.
awk -F'\t' -v base="$base_file" '
  FILENAME == base { seen[$1] = 1; next }
  !($1 in seen)
' "$base_file" "$head_file" >"$new_file"

# --- 5. Report ----------------------------------------------------------------
count="$(awk 'END { print NR }' "$new_file")"

if [ "$count" -eq 0 ]; then
  printf 'No new blocking code-scanning alerts on %s.\n' "$ref"
  {
    printf '### Code scanning gate\n\n'
    printf "No new high/critical code-scanning alerts on \`%s\`.\n" "$ref"
  } >>"$STEP_SUMMARY"
  exit 0
fi

{
  printf '### Code scanning gate — FAILED\n\n'
  printf "%s new blocking alert(s) on \`%s\`:\n\n" "$count" "$ref"
  while IFS=$'\t' read -r number severity rule path url; do
    printf -- "- **%s** \`%s\` in \`%s\` ([alert #%s](%s))\n" \
      "$severity" "$rule" "$path" "$number" "$url"
  done <"$new_file"
} | tee -a "$STEP_SUMMARY"

fail "${count} new high/critical code-scanning alert(s) on ${ref}; see the job summary."
exit 1
