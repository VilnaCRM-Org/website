#!/usr/bin/env bash
# The e2e flake census tracker (#359, #445): file, refresh or close the ONE
# `e2e-flake` issue from the verdict `make check-e2e-flakes FLAKE_MODE=census`
# recorded. Run by .github/workflows/e2e-flake-census.yml.
#
# WHY A SCRIPT -- the inline block this replaces commented on the tracker after
# every census, clean or not, and nothing ever closed it: #445 was opened by a
# census that measured nothing and then collected a month of "No flaky tests
# detected" comments. As a script the three outcomes are driven end to end by
# tests/bats/e2e_flake_census.bats against a stubbed `gh`.
#
# Verdicts (the one line in CENSUS_VERDICT_FILE):
#   clean       at least one test executed, nothing flaky, broken or errored --
#               close the open tracker with a comment linking the run
#   findings    flaky or consistently failing tests, or a run-level error --
#               file the tracker, or comment on the open one
#   unmeasured  no report, or no test executed -- file/refresh the tracker AND
#               exit 1, so a census that measured nothing is a red run and can
#               never be mistaken for a clean one
# A missing or empty verdict file reads as `unmeasured`: the checker that writes
# it failed, which is a failed measurement, not a clean one.
#
# CENSUS_DRY_RUN=1 performs no write at all (the workflow sets it off the
# default branch, whose census does not describe main). Reads still happen.
#
# Requires: gh (authenticated through GH_TOKEN) and jq.
set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
if [ -z "$REPO" ]; then
  echo "e2e-flake-census-issue: GH_REPO or GITHUB_REPOSITORY must be set" >&2
  exit 2
fi
export GH_REPO="$REPO"

LABEL='e2e-flake'
TITLE='e2e flake census'
DRY_RUN="${CENSUS_DRY_RUN:-0}"
VERDICT_FILE="${CENSUS_VERDICT_FILE:-census-verdict.txt}"
REPORT_FILE="${CENSUS_REPORT_FILE:-census.md}"
RUN_URL="${RUN_URL:-}"
SUMMARY="${GITHUB_STEP_SUMMARY:-/dev/null}"

if [ -z "$RUN_URL" ]; then
  echo "e2e-flake-census-issue: RUN_URL must be set" >&2
  exit 2
fi

verdict="$(tr -d '[:space:]' <"$VERDICT_FILE" 2>/dev/null || true)"
case "$verdict" in
  clean | findings | unmeasured) ;;
  '') verdict='unmeasured' ;;
  *)
    echo "e2e-flake-census-issue: unknown census verdict '${verdict}' in ${VERDICT_FILE}" >&2
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
  if [ -s "$REPORT_FILE" ]; then
    cat "$REPORT_FILE"
  else
    printf 'The census produced no summary; see the run log.\n'
  fi
}

# Every open tracker carrying EXACTLY the title. `--search ... in:title` is a
# fuzzy word match, so the exact filter (the title reaches jq as DATA via
# --arg) is what keeps a clean census from closing some other e2e-flake issue.
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
    --description 'Nightly e2e flake census findings' >/dev/null 2>&1 || true
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
    echo "::warning::could not list open ${LABEL} issues; no flake tracker was closed"
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
      'This census executed the suite and found nothing flaky, broken or errored, so the tracker is closed. The next census with a finding files a new one.')"
    ;;
  findings)
    file_or_refresh "$(printf '%s\n\n%s\n' "$(census_markdown)" "$footer")"
    ;;
  unmeasured)
    file_or_refresh "$(printf '%s\n\n%s\n\n%s\n' \
      '**This census measured nothing. It is not a clean result, so the tracker stays open.**' \
      "$(census_markdown)" "$footer")"
    echo "::error::The e2e flake census measured nothing (no report, or no test executed); see ${RUN_URL}"
    exit 1
    ;;
esac
