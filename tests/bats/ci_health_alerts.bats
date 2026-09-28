#!/usr/bin/env bats
#
# Coverage for scripts/ci/ci-health-alert.sh, the post-merge CI health alerter
# behind .github/workflows/ci-health-alerts.yml (issue #365; revived under
# issues #325, #329 and #331).
#
# Why this file exists: the alert logic used to be inline `run:` blocks that
# only ever executed post-merge, and for their first ~100 runs every gh call
# died with `failed to run git: fatal: not a git repository` -- the job had no
# checkout and no repository context, so no `ci-alert` issue was ever filed
# while the release lane it monitors was red on every push. Nothing at PR time
# could have caught that, because nothing could run the block. Everything here
# drives the real script against a stubbed `gh` that records the repository
# context each call ran under, so the fail-open cannot come back unnoticed.
#
# Workflow-shape assertions (job-level GH_REPO, the dispatch dry-run default,
# the recovery guard) live in tests/bats/security_workflows.bats.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/ci-health-alert.sh'
REPO='VilnaCRM-Org/website'
WEBSITE_ALERT_TITLE="CI health: 'website' workflow is failing"
RED_MAIN_TITLE='CI health: main is red'

# A `gh` double that records its argv TOGETHER WITH the GH_REPO it ran under,
# serves canned JSON per subcommand/endpoint, and applies the caller's own --jq
# filter with the real jq so the script's jq programs are genuinely executed.
create_alert_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'STUB'
#!/usr/bin/env bash
# The repository context is part of the record: a call that would have fallen
# back to the git remote of the working directory is exactly the defect this
# suite exists to keep out.
printf 'gh [GH_REPO=%s] %s\n' "${GH_REPO-<unset>}" "$*" >> "${COMMAND_LOG:?}"

jq_filter=""
prev=""
for arg in "$@"; do
  if [ "$prev" = "--jq" ]; then jq_filter="$arg"; fi
  prev="$arg"
done

emit() {
  if [ -n "$jq_filter" ]; then
    printf '%s' "$1" | jq -r "$jq_filter"
  else
    printf '%s' "$1"
  fi
}

sub="${1:-}"
shift || true

case "$sub" in
  label)
    exit 0
    ;;
  issue)
    case "${1:-}" in
      list) emit "${FAKE_ALERT_LIST:-[]}" ;;
      create) printf 'https://github.com/o/r/issues/%s\n' "${FAKE_NEW_ISSUE_NUMBER:-7}" ;;
      *) : ;;
    esac
    exit 0
    ;;
  run)
    emit "${FAKE_RUN_LIST:-[]}"
    exit 0
    ;;
  api)
    check_runs="${FAKE_CHECK_RUNS:-}"
    [ -n "$check_runs" ] || check_runs='{"check_runs":[]}'
    case "$*" in
      *check-runs*) emit "$check_runs" ;;
      */commits/main*) emit "{\"sha\":\"${FAKE_MAIN_SHA:-0123abcd}\"}" ;;
      *code-scanning/alerts*)
        if [ -n "${FAKE_CODE_SCANNING_FAIL:-}" ]; then
          echo 'gh: 503 Service Unavailable' >&2
          exit 1
        fi
        emit "$(cat "${FAKE_CODE_SCANNING_ALERTS:-/dev/null}")"
        ;;
      *) emit '{}' ;;
    esac
    exit 0
    ;;
esac
exit 0
STUB

  chmod +x "$STUB_BIN_DIR/gh"
}

# `-u GH_REPO` is load-bearing: the script must derive the context from the
# GITHUB_REPOSITORY every runner sets, so a developer's own GH_REPO must not be
# what makes these pass.
run_alert() {
  run env -u GH_REPO \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_STEP_SUMMARY="$SUMMARY" \
    GITHUB_REPOSITORY="$REPO" \
    GITHUB_SERVER_URL='https://github.com' \
    GH_TOKEN=stub-token \
    RUN_URL='https://github.com/VilnaCRM-Org/website/actions/runs/1' \
    "$@" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

refute_log_contains() {
  local unexpected="$1"

  if grep -F -- "$unexpected" "$COMMAND_LOG" >/dev/null 2>&1; then
    echo "Expected command log NOT to contain: $unexpected" >&2
    echo "--- command log ---" >&2
    cat "$COMMAND_LOG" >&2
    return 1
  fi
}

# Every recorded gh call carried the repository context, and at least one call
# was made -- an empty log would otherwise pass vacuously.
assert_every_gh_call_scoped() {
  local unscoped

  [ -s "$COMMAND_LOG" ]
  unscoped="$(grep -v -F "[GH_REPO=$REPO]" "$COMMAND_LOG" || true)"
  if [ -n "$unscoped" ]; then
    echo "gh calls made without the repository context:" >&2
    printf '%s\n' "$unscoped" >&2
    return 1
  fi
}

refute_any_write() {
  refute_log_contains 'gh [GH_REPO='"$REPO"'] issue create'
  refute_log_contains 'gh [GH_REPO='"$REPO"'] issue comment'
  refute_log_contains 'gh [GH_REPO='"$REPO"'] issue close'
  refute_log_contains 'gh [GH_REPO='"$REPO"'] label create'
}

check_run() {
  jq -nc --arg status "$1" --arg conclusion "$2" \
    '{status: $status, conclusion: (if $conclusion == "" then null else $conclusion end)}'
}

check_runs() {
  jq -nc --slurpfile runs <(printf '%s\n' "$@") '{check_runs: $runs}'
}

setup() {
  setup_stub_dir
  create_alert_gh_stub

  SUMMARY="$BATS_TEST_TMPDIR/step-summary.md"
  : >"$SUMMARY"

  OPEN_WEBSITE_ALERT="$(jq -nc --arg t "$WEBSITE_ALERT_TITLE" '[{number: 42, title: $t}]')"
  OPEN_RED_MAIN_ALERT="$(jq -nc --arg t "$RED_MAIN_TITLE" '[{number: 43, title: $t}]')"
}

# --- repository context --------------------------------------------------------

@test "exits 2 with a clear message when no repository context is available" {
  run env -u GH_REPO -u GITHUB_REPOSITORY \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    ALERT_EVENT=sweep \
    bash "$PROJECT_ROOT/$SCRIPT_REL"

  [ "$status" -eq 2 ]
  assert_output_contains 'GH_REPO or GITHUB_REPOSITORY must be set'
  # It fails BEFORE the first gh call, not on it.
  [ ! -s "$COMMAND_LOG" ]
}

@test "every gh call in the failure path runs with the repository context exported" {
  run_alert ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_every_gh_call_scoped
}

@test "every gh call in the recovery path runs with the repository context exported" {
  run_alert \
    FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" \
    FAKE_RUN_LIST='[{"conclusion":"success"}]' \
    ALERT_EVENT=recovery WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_every_gh_call_scoped
}

@test "every gh call in the sweep runs with the repository context exported" {
  run_alert \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed failure)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_every_gh_call_scoped
}

@test "an explicit GH_REPO wins over the runner's GITHUB_REPOSITORY" {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_REPOSITORY="$REPO" \
    GH_REPO='VilnaCRM-Org/fork' \
    GH_TOKEN=stub-token \
    ALERT_EVENT=failure WORKFLOW_NAME=website RUN_URL=https://example.test/1 \
    bash "$PROJECT_ROOT/$SCRIPT_REL"

  [ "$status" -eq 0 ]
  assert_log_contains 'gh [GH_REPO=VilnaCRM-Org/fork] issue list'
  refute_log_contains "[GH_REPO=$REPO]"
}

@test "the scoping assertion rejects a call made without the repository context" {
  # Negative control for assert_every_gh_call_scoped: the shape of the original
  # defect -- a gh call reaching the CLI with no GH_REPO -- must fail it, or the
  # three tests above would pass against a script that forgot the export.
  env -u GH_REPO PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" \
    gh issue list --label ci-alert --state open --json number,title >/dev/null

  assert_log_contains 'gh [GH_REPO=<unset>] issue list'
  run assert_every_gh_call_scoped
  [ "$status" -ne 0 ]
}

# --- failure: file or refresh --------------------------------------------------

@test "files a new labelled alert when no alert is open for the workflow" {
  run_alert ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'label create ci-alert'
  assert_log_contains "issue create --label ci-alert --title $WEBSITE_ALERT_TITLE --body The 'website' workflow failed. Latest run: https://github.com/VilnaCRM-Org/website/actions/runs/1"
  refute_log_contains 'issue comment'
  assert_output_contains "created '$WEBSITE_ALERT_TITLE'"
}

@test "comments on the open alert instead of opening a duplicate" {
  run_alert FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'issue comment 42 --body Still failing: https://github.com/VilnaCRM-Org/website/actions/runs/1'
  refute_log_contains 'issue create'
  assert_output_contains 'commented on #42'
}

@test "matches the open alert by exact title, not by the fuzzy search hit" {
  # `--search ... in:title` is a word match, so an open alert for ANOTHER
  # workflow can come back from the lookup. Absorbing this failure into it would
  # leave the failing workflow with no alert of its own.
  run_alert \
    FAKE_ALERT_LIST='[{"number":9,"title":"CI health: '"'"'website deploy'"'"' workflow is failing"}]' \
    ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains "issue create --label ci-alert --title $WEBSITE_ALERT_TITLE"
  refute_log_contains 'issue comment 9'
}

@test "attaches the blocking code-scanning digest to a failed security scan" {
  run_alert \
    FAKE_CODE_SCANNING_ALERTS="$PROJECT_ROOT/tests/bats/fixtures/code-scanning/pr-alerts-new.json" \
    ALERT_EVENT=failure WORKFLOW_NAME='security testing'

  [ "$status" -eq 0 ]
  assert_log_contains 'api -X GET repos/VilnaCRM-Org/website/code-scanning/alerts'
  assert_log_contains 'Open blocking code-scanning alerts on main:'
  # critical, high, and rule-severity error are listed; medium/warning is not.
  assert_log_contains '- [high] js/xss in src/a.ts'
  assert_log_contains '- [critical] js/sql-injection in src/e.ts'
  assert_log_contains '- [error] js/incomplete-sanitization in src/f.ts'
  refute_log_contains 'js/regex-injection'
}

@test "does not query code scanning for any other monitored workflow" {
  run_alert \
    FAKE_CODE_SCANNING_ALERTS="$PROJECT_ROOT/tests/bats/fixtures/code-scanning/pr-alerts-new.json" \
    ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  refute_log_contains 'code-scanning'
  refute_log_contains 'Open blocking code-scanning alerts'
}

@test "still files the alert when the code-scanning digest cannot be read" {
  run_alert \
    FAKE_CODE_SCANNING_FAIL=1 \
    ALERT_EVENT=failure WORKFLOW_NAME='security testing'

  [ "$status" -eq 0 ]
  assert_log_contains "issue create --label ci-alert --title CI health: 'security testing' workflow is failing --body The 'security testing' workflow failed. Latest run: https://github.com/VilnaCRM-Org/website/actions/runs/1"
}

@test "exits 2 when the failure path is given no workflow name" {
  run_alert ALERT_EVENT=failure

  [ "$status" -eq 2 ]
  assert_output_contains 'WORKFLOW_NAME must be set'
  [ ! -s "$COMMAND_LOG" ]
}

# --- recovery: close ------------------------------------------------------------

@test "closes the open alert once the latest run on main is green" {
  run_alert \
    FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" \
    FAKE_RUN_LIST='[{"conclusion":"success"}]' \
    ALERT_EVENT=recovery WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'run list --workflow website --branch main --limit 1'
  assert_log_contains "issue comment 42 --body Recovered: 'website' is green again (latest main run succeeded). Closing."
  assert_log_contains 'issue close 42'
}

@test "leaves the alert open when a stale success arrives after a newer failure" {
  run_alert \
    FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" \
    FAKE_RUN_LIST='[{"conclusion":"failure"}]' \
    ALERT_EVENT=recovery WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  refute_log_contains 'issue close'
  refute_log_contains 'issue comment'
  assert_output_contains '#42 stays open'
}

@test "recovery with no open alert makes no write and does not consult the run list" {
  run_alert \
    FAKE_RUN_LIST='[{"conclusion":"success"}]' \
    ALERT_EVENT=recovery WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'issue list'
  refute_log_contains 'run list'
  refute_any_write
  assert_output_contains 'nothing to close'
}

# --- sweep: red default branch -------------------------------------------------

@test "the sweep files the red-main alert when a completed check-run is not green" {
  run_alert \
    FAKE_MAIN_SHA=feedface \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed success)" "$(check_run completed failure)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_log_contains 'api repos/VilnaCRM-Org/website/commits/main'
  assert_log_contains 'api repos/VilnaCRM-Org/website/commits/feedface/check-runs?per_page=100'
  assert_log_contains "issue create --label ci-alert --title $RED_MAIN_TITLE --body The default branch has 1 failing check-run(s) at feedface: https://github.com/VilnaCRM-Org/website/commit/feedface"
}

@test "the sweep counts cancelled and timed-out check-runs as red, not only failure" {
  run_alert \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed cancelled)" "$(check_run completed timed_out)" "$(check_run completed neutral)" "$(check_run completed skipped)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_log_contains 'has 2 failing check-run(s)'
}

@test "the sweep refreshes the open red-main alert instead of duplicating it" {
  run_alert \
    FAKE_MAIN_SHA=feedface \
    FAKE_ALERT_LIST="$OPEN_RED_MAIN_ALERT" \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed failure)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_log_contains 'issue comment 43 --body main still red at feedface (1 failing check-run(s)): https://github.com/VilnaCRM-Org/website/commit/feedface'
  refute_log_contains 'issue create'
}

@test "the sweep closes the alert once every check-run has completed green" {
  run_alert \
    FAKE_MAIN_SHA=feedface \
    FAKE_ALERT_LIST="$OPEN_RED_MAIN_ALERT" \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed success)" "$(check_run completed skipped)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_log_contains 'issue comment 43 --body main is green again at feedface. Closing.'
  assert_log_contains 'issue close 43'
}

@test "the sweep keeps the alert open while a check-run is still running" {
  # A commit whose checks have not all completed is not "recovered".
  run_alert \
    FAKE_ALERT_LIST="$OPEN_RED_MAIN_ALERT" \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed success)" "$(check_run in_progress '')")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  refute_any_write
  assert_output_contains '0 failing, 1 incomplete'
  assert_output_contains 'nothing to file or close'
}

@test "a green sweep with no open alert writes nothing" {
  run_alert \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed success)")" \
    ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  refute_any_write
}

# --- dry run ------------------------------------------------------------------

@test "a dry run of the failure path reads the API but writes nothing" {
  run_alert ALERT_DRY_RUN=1 ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'issue list'
  refute_any_write
  assert_output_contains "dry run -- would create '$WEBSITE_ALERT_TITLE'"

  reset_command_log
  run_alert FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" ALERT_DRY_RUN=1 ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  refute_any_write
  assert_output_contains 'dry run -- would comment on #42'
}

@test "a dry run of the recovery path writes nothing" {
  run_alert \
    FAKE_ALERT_LIST="$OPEN_WEBSITE_ALERT" \
    FAKE_RUN_LIST='[{"conclusion":"success"}]' \
    ALERT_DRY_RUN=1 ALERT_EVENT=recovery WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  assert_log_contains 'run list'
  refute_any_write
  assert_output_contains 'dry run -- would close #42'
}

@test "a dry run of a red sweep writes nothing" {
  run_alert \
    FAKE_CHECK_RUNS="$(check_runs "$(check_run completed failure)")" \
    ALERT_DRY_RUN=1 ALERT_EVENT=sweep

  [ "$status" -eq 0 ]
  assert_log_contains 'check-runs'
  refute_any_write
  assert_output_contains "dry run -- would create '$RED_MAIN_TITLE'"
}

@test "mirrors every decision into the GitHub step summary" {
  run_alert ALERT_DRY_RUN=1 ALERT_EVENT=failure WORKFLOW_NAME=website

  [ "$status" -eq 0 ]
  grep -Fq "would create '$WEBSITE_ALERT_TITLE'" "$SUMMARY"
}

# --- misuse -------------------------------------------------------------------

@test "exits 2 on an unknown or missing mode without touching the API" {
  run_alert ALERT_EVENT=bogus
  [ "$status" -eq 2 ]
  assert_output_contains 'ALERT_EVENT must be failure|recovery|sweep'
  [ ! -s "$COMMAND_LOG" ]

  run_alert
  [ "$status" -eq 2 ]
}

# --- the script and the gate agree on what "blocking" means --------------------

@test "the alert script is executable and never invokes a version-control write" {
  # The workflow runs it from a sparse checkout with no credentials persisted,
  # and its only mutations are issue writes made with GITHUB_TOKEN.
  [ -x "$PROJECT_ROOT/$SCRIPT_REL" ]
  run grep -nE '(^|[;&|(]|[[:space:]])git([[:space:]]|$)' "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -ne 0 ]
  [ -z "$output" ]
}
