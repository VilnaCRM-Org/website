#!/usr/bin/env bash
# The nightly mutation census tracker (#345, #513): file, refresh or close the ONE
# `mutation-backlog` issue from the verdict `make merge-mutation-reports
# MUTATION_SCOPE=full` recorded. Run by the census-report job of
# .github/workflows/mutation-testing.yml.
#
# WHY A SCRIPT -- the inline step this replaces commented on the tracker after
# every census, even one at 100% with no surviving or uncovered mutant, and
# nothing ever closed it: #456 collected five clean-run comments before it was
# closed by hand, #503 was closed by hand, and the next clean census filed #513.
# This is the #445 fix to the e2e flake census (scripts/ci/e2e-flake-census-issue.sh)
# applied to the mutation census; tests/bats/mutation_census.bats drives every
# outcome end to end against a stubbed `gh`.
#
# Verdicts (the one line in CENSUS_VERDICT_FILE, written by
# scripts/ci/merge-mutation-reports.ts from the same rows as the summary table):
#   clean       no mutant survived and none ran uncovered -- comment the summary
#               and run link on every open tracker, then close it; file nothing
#   findings    at least one surviving or uncovered mutant -- file the tracker,
#               or comment on the open one
# A missing or empty verdict file reads as `unmeasured`: a census shard did not
# run or the merge threw, which is a failed measurement, not a clean one. It
# files/refreshes the tracker AND exits 1, so it can never pass as clean.
#
# CENSUS_DRY_RUN=1 performs no write at all (the workflow sets it off the
# default branch, whose census does not describe main). Reads still happen.
#
# Requires: gh (authenticated through GH_TOKEN) and jq.
set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
if [ -z "$REPO" ]; then
  echo "mutation-census-issue: GH_REPO or GITHUB_REPOSITORY must be set" >&2
  exit 2
fi
export GH_REPO="$REPO"

LABEL='mutation-backlog'
TITLE='mutation testing backlog'
DRY_RUN="${CENSUS_DRY_RUN:-0}"
VERDICT_FILE="${CENSUS_VERDICT_FILE:-reports/mutation/census-verdict.txt}"
REPORT_FILE="${CENSUS_REPORT_FILE:-reports/mutation/summary.md}"
RUN_URL="${RUN_URL:-}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"
# GitHub rejects an issue body over 65536 characters, and the summary carries one
# table row per file with an undetected mutant. 60000 leaves room for the footer;
# the full table is always in the run's artifact.
BODY_CAP=60000

if [ -z "$RUN_URL" ]; then
  echo "mutation-census-issue: RUN_URL must be set" >&2
  exit 2
fi

verdict="$(tr -d '[:space:]' <"$VERDICT_FILE" 2>/dev/null || true)"
case "$verdict" in
  clean | findings) ;;
  '') verdict='unmeasured' ;;
  *)
    echo "mutation-census-issue: unknown census verdict '${verdict}' in ${VERDICT_FILE}" >&2
    exit 2
    ;;
esac

# The decision on stdout and in the job summary, so a dry run is readable from
# the Actions UI without opening the log.
record() {
  printf '%s\n' "$*"
  printf -- '- %s\n' "$*" >>"$SUMMARY"
}

census_markdown() {
  if [ ! -s "$REPORT_FILE" ]; then
    printf 'The census produced no summary; see the run log.\n'
    return 0
  fi
  head -c "$BODY_CAP" "$REPORT_FILE"
  if [ "$(wc -c <"$REPORT_FILE")" -gt "$BODY_CAP" ]; then
    printf '\n\n%s\n' "_Table truncated; the full report is in this run's artifact._"
  fi
}

# Every open tracker carrying EXACTLY the title. `--search ... in:title` is a
# fuzzy word match, so the exact filter (the title reaches jq as DATA via
# --arg) is what keeps a clean census from closing some other mutation-backlog
# issue.
open_trackers() {
  gh issue list --label "$LABEL" --state open --limit 100 \
    --search "\"$TITLE\" in:title" --json number,title |
    jq -r --arg t "$TITLE" 'map(select(.title == $t)) | .[].number'
}

file_or_refresh() {
  local body="$1" existing
  # No fallback on a failed lookup: an empty answer reads as "no tracker
  # exists" and would file a duplicate every night the API blips.
  existing="$(open_trackers | head -n 1)"
  if [ "$DRY_RUN" = '1' ] && [ -n "$existing" ]; then
    record "dry run -- would comment on #${existing} (${verdict})"
    return 0
  elif [ "$DRY_RUN" = '1' ]; then
    record "dry run -- would create '${TITLE}' (${verdict})"
    return 0
  fi
  # Idempotent: a missing label must not fail the census, but `gh issue create`
  # errors on an unknown one.
  gh label create "$LABEL" --color FBCA04 \
    --description 'Nightly mutation census findings' >/dev/null 2>&1 || true
  if [ -n "$existing" ]; then
    gh issue comment "$existing" --body "$body" >/dev/null
    record "commented on #${existing} (${verdict})"
  else
    gh issue create --label "$LABEL" --title "$TITLE" --body "$body" >/dev/null
    record "created '${TITLE}' (${verdict})"
  fi
}

close_trackers() {
  local body="$1" listed number
  # A failed lookup closes nothing, which is harmless, so it warns instead of
  # turning a clean census red. The warning is what keeps a stale tracker from
  # sitting open behind a green run unnoticed.
  if ! listed="$(open_trackers)"; then
    echo "::warning::could not list open ${LABEL} issues; no mutation tracker was closed"
    return 0
  fi
  if [ -z "$listed" ]; then
    record "clean census; no open '${TITLE}' tracker to close"
    return 0
  fi
  for number in $listed; do
    if [ "$DRY_RUN" = '1' ]; then
      record "dry run -- would close #${number} (clean)"
      continue
    fi
    gh issue comment "$number" --body "$body" >/dev/null
    gh issue close "$number" >/dev/null
    record "closed #${number} (clean)"
  done
}

footer="Census run: ${RUN_URL}"

case "$verdict" in
  clean)
    close_trackers "$(printf '%s\n\n%s\n\n%s\n' "$(census_markdown)" "$footer" \
      'This census found no surviving or uncovered mutant in the full scope, so the tracker is closed. The next census with a finding files a new one.')"
    ;;
  findings)
    file_or_refresh "$(printf '%s\n\n%s\n' "$(census_markdown)" "$footer")"
    ;;
  unmeasured)
    file_or_refresh "$(printf '%s\n\n%s\n\n%s\n' \
      '**This census did not measure the mutation backlog. It is not a clean result, so the tracker stays open.**' \
      "$(census_markdown)" "$footer")"
    echo "::error::The mutation census recorded no verdict (a census shard did not run, or the merge failed); see ${RUN_URL}"
    exit 1
    ;;
esac
