#!/usr/bin/env bats
#
# Coverage for the e2e flake census tracker (#359, #445): the census verdict
# written by scripts/ci/check-flaky-report.ts and the issue lifecycle
# scripts/ci/e2e-flake-census-issue.sh drives from it.
#
# Why this file exists: the tracker step used to comment on the open issue after
# EVERY census and never close it, so #445 -- opened by a census that measured
# nothing -- collected a month of "No flaky tests detected" comments. Each case
# below runs the REAL checker over a Playwright report fixture and hands its
# verdict to the REAL issue script against a stubbed `gh`, so the three outcomes
# (clean closes, findings refresh, measured-nothing stays open and goes red) are
# proved end to end rather than per half.

load './test_helper.bash'

REPO='VilnaCRM-Org/website'
TITLE='e2e flake census'
RUN_URL='https://github.com/VilnaCRM-Org/website/actions/runs/1'

# A `gh` double that records argv with the GH_REPO it ran under and applies the
# caller's --jq filter with the real jq. `issue list` serves FAKE_ISSUE_LIST, or
# fails like a rate-limited API when FAKE_LIST_FAIL is set.
create_census_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh [GH_REPO=%s] %s\n' "${GH_REPO-<unset>}" "$*" >> "${COMMAND_LOG:?}"
case "${1:-} ${2:-}" in
  'issue list')
    if [ -n "${FAKE_LIST_FAIL:-}" ]; then
      echo 'gh: HTTP 502' >&2
      exit 1
    fi
    printf '%s' "${FAKE_ISSUE_LIST:-[]}"
    ;;
  'issue create') printf 'https://github.com/o/r/issues/9\n' ;;
esac
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/gh"
}

refute_log_contains() {
  if grep -F -- "$1" "$COMMAND_LOG" >/dev/null 2>&1; then
    echo "Expected command log NOT to contain: $1" >&2
    cat "$COMMAND_LOG" >&2
    return 1
  fi
}

refute_any_write() {
  refute_log_contains 'issue create'
  refute_log_contains 'issue comment'
  refute_log_contains 'issue close'
  refute_log_contains 'label create'
}

# One spec in one project, repeated with the given per-repetition outcomes, in
# Playwright's JSON reporter shape: pass | fail | skip (test.skip) | interrupt (cut
# short by a SIGINT) | unstarted (the run stopped before reaching it). The last
# two are what a step timeout leaves, and Playwright grades both `skipped`.
write_report() {
  local outcomes=("$@") tests='' outcome status expected results
  for outcome in "${outcomes[@]}"; do
    expected='passed'
    case "$outcome" in
      pass) status='expected' results='[{"status":"passed"}]' ;;
      fail) status='unexpected' results='[{"status":"failed"}]' ;;
      skip) status='skipped' expected='skipped' results='[{"status":"skipped"}]' ;;
      interrupt) status='skipped' results='[{"status":"interrupted"}]' ;;
      unstarted) status='skipped' results='[]' ;;
    esac
    tests+="{\"projectName\":\"chromium\",\"expectedStatus\":\"$expected\",\"status\":\"$status\",\"results\":$results},"
  done
  mkdir -p "$WORK/burn-in-results"
  printf '{"suites":[{"file":"src/test/e2e/a.spec.ts","specs":[{"title":"loads","tests":[%s]}]}]}\n' \
    "${tests%,}" >"$WORK/burn-in-results/results.json"
}

# The workflow's "Summarise the flakes" step: the real checker, run from the
# work directory it treats as the repository root.
run_census() {
  (cd "$WORK" &&
    FLAKE_MODE=census FLAKE_REPORT_DIR=burn-in-results \
      FLAKE_CENSUS_VERDICT_FILE=census-verdict.txt \
      bun "$PROJECT_ROOT/scripts/ci/check-flaky-report.ts" >census.md)
}

# The workflow's tracker step. `-u GH_REPO`: the context must come from the
# GITHUB_REPOSITORY every runner sets, not from a developer's shell.
run_tracker() {
  run env -u GH_REPO -C "$WORK" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_STEP_SUMMARY="$WORK/summary.md" \
    GITHUB_REPOSITORY="$REPO" \
    RUN_URL="$RUN_URL" \
    "$@" \
    bash "$PROJECT_ROOT/scripts/ci/e2e-flake-census-issue.sh"
}

setup() {
  setup_stub_dir
  create_census_gh_stub
  WORK="$BATS_TEST_TMPDIR/work"
  mkdir -p "$WORK"
  OPEN_TRACKER="$(jq -nc --arg t "$TITLE" '[{number: 445, title: $t}]')"
}

# --- the three outcomes ----------------------------------------------------------

@test "a clean census that executed tests closes the open tracker with the run link" {
  write_report pass pass pass
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'clean' ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue comment 445 --body"
  assert_log_contains "Census run: $RUN_URL"
  assert_log_contains "gh [GH_REPO=$REPO] issue close 445"
  refute_log_contains 'issue create'
}

@test "a clean census with no open tracker writes nothing" {
  write_report pass pass pass
  run_census

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 0 ]
  assert_output_contains 'no open'
  refute_any_write
}

@test "a clean census never closes an e2e-flake issue with a different title" {
  write_report pass pass
  run_census

  run_tracker FAKE_ISSUE_LIST='[{"number":12,"title":"e2e flake census: webkit swagger"}]'

  [ "$status" -eq 0 ]
  refute_log_contains 'issue close'
}

@test "a census that found a flake refreshes the open tracker and stays green" {
  write_report pass fail fail
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'findings' ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue comment 445 --body Read 1 Playwright report(s)"
  assert_log_contains 'Detected 1 flaky test(s)'
  refute_log_contains 'issue close'
  refute_log_contains 'issue create'
}

@test "a census that found a flake files the tracker when none is open" {
  write_report fail pass fail
  run_census

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue create --label e2e-flake --title $TITLE --body"
  refute_log_contains 'issue close'
}

@test "a single failed repetition below the flake threshold never closes the tracker" {
  write_report pass fail pass
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'findings' ]
  grep -F 'fewer repetitions than the flake threshold (2)' "$WORK/census.md"
  grep -F -- '- src/test/e2e/a.spec.ts › loads [chromium] — 1/3 attempt(s) failed' "$WORK/census.md"

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 0 ]
  assert_log_contains 'issue comment 445'
  refute_log_contains 'issue close'
}

@test "a test that failed every repetition is a finding, never a clean census" {
  write_report fail fail fail
  run_census

  [ "$(cat "$WORK/census-verdict.txt")" = 'findings' ]
  grep -F 'consistently broken' "$WORK/census.md"
}

@test "a run-level error keeps an otherwise green census from reading as clean" {
  mkdir -p "$WORK/burn-in-results"
  printf '%s\n' '{"errors":[{"message":"Error: cannot load b.spec.ts\n    at x"}],"suites":[{"file":"a.spec.ts","specs":[{"title":"t","tests":[{"status":"expected","results":[{"status":"passed"}]}]}]}]}' \
    >"$WORK/burn-in-results/results.json"
  run_census

  [ "$(cat "$WORK/census-verdict.txt")" = 'findings' ]
  grep -F -- '- Error: cannot load b.spec.ts' "$WORK/census.md"
  [ "$(grep -cF 'at x' "$WORK/census.md")" -eq 0 ]
}

@test "a census with no report keeps the tracker open and fails the run" {
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'unmeasured' ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 1 ]
  assert_output_contains '::error::The e2e flake census did not measure the suite'
  assert_log_contains 'issue comment 445 --body **This census did not measure the suite.'
  refute_log_contains 'issue close'
}

@test "a burn-in cut short after some tests passed keeps the tracker open and fails the run" {
  write_report pass interrupt unstarted
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'unmeasured' ]
  grep -F 'The run stopped before 2 test run(s) finished' "$WORK/census.md"

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 1 ]
  assert_output_contains '::error::The e2e flake census did not measure the suite'
  assert_log_contains 'issue comment 445'
  refute_log_contains 'issue close'
}

@test "a deliberately skipped test does not stop a finished census reading as clean" {
  write_report pass skip pass
  run_census

  [ "$(cat "$WORK/census-verdict.txt")" = 'clean' ]
}

@test "a report in which every test was skipped measured nothing" {
  write_report skip skip
  run_census
  [ "$(cat "$WORK/census-verdict.txt")" = 'unmeasured' ]

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 1 ]
  assert_log_contains "issue create --label e2e-flake --title $TITLE"
  refute_log_contains 'issue close'
}

@test "a missing verdict file reads as measured nothing, never as clean" {
  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 1 ]
  assert_log_contains 'issue comment 445'
  assert_log_contains 'The census produced no summary'
  refute_log_contains 'issue close'
}

# --- failure modes and guards ------------------------------------------------------

@test "an unknown verdict is refused before any gh call" {
  printf 'green\n' >"$WORK/census-verdict.txt"

  run_tracker

  [ "$status" -eq 2 ]
  assert_output_contains "unknown census verdict 'green'"
  [ ! -s "$COMMAND_LOG" ]
}

@test "a failed lookup on a findings census fails rather than filing a duplicate" {
  printf 'findings\n' >"$WORK/census-verdict.txt"

  run_tracker FAKE_LIST_FAIL=1

  [ "$status" -ne 0 ]
  refute_log_contains 'issue create'
}

@test "a failed lookup on a clean census warns and leaves the run green" {
  printf 'clean\n' >"$WORK/census-verdict.txt"

  run_tracker FAKE_LIST_FAIL=1

  [ "$status" -eq 0 ]
  assert_output_contains '::warning::could not list open e2e-flake issues'
  refute_any_write
}

@test "a dry run reads but never writes, and still fails a census that measured nothing" {
  printf 'clean\n' >"$WORK/census-verdict.txt"
  run_tracker CENSUS_DRY_RUN=1 FAKE_ISSUE_LIST="$OPEN_TRACKER"
  [ "$status" -eq 0 ]
  assert_output_contains 'dry run -- would close #445'
  refute_any_write

  printf 'unmeasured\n' >"$WORK/census-verdict.txt"
  reset_command_log
  run_tracker CENSUS_DRY_RUN=1 FAKE_ISSUE_LIST="$OPEN_TRACKER"
  [ "$status" -eq 1 ]
  assert_output_contains 'dry run -- would comment on #445 (unmeasured)'
  refute_any_write
}

@test "exits 2 without a repository context, before any gh call" {
  printf 'clean\n' >"$WORK/census-verdict.txt"
  run env -u GH_REPO -u GITHUB_REPOSITORY -C "$WORK" \
    PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" RUN_URL="$RUN_URL" \
    bash "$PROJECT_ROOT/scripts/ci/e2e-flake-census-issue.sh"

  [ "$status" -eq 2 ]
  assert_output_contains 'GH_REPO or GITHUB_REPOSITORY must be set'
  [ ! -s "$COMMAND_LOG" ]
}

# --- workflow wiring -----------------------------------------------------------------

@test "the census workflow hands the verdict file to the tracker script and gates writes on main" {
  local doc="$BATS_TEST_TMPDIR/census.json"
  node -e '
    const yaml = require(process.argv[2] + "/node_modules/js-yaml");
    const fs = require("fs");
    process.stdout.write(JSON.stringify(yaml.load(fs.readFileSync(process.argv[1], "utf8"))));
  ' "$PROJECT_ROOT/.github/workflows/e2e-flake-census.yml" "$PROJECT_ROOT" >"$doc"

  # Exactly one step runs the tracker script, and nothing else touches issues.
  [ "$(jq '[.jobs.census.steps[] | select((.run // "") == "bash scripts/ci/e2e-flake-census-issue.sh")] | length' "$doc")" -eq 1 ]
  [ "$(jq '[.jobs.census.steps[] | select((.run // "") | test("gh issue"))] | length' "$doc")" -eq 0 ]

  jq -e '.jobs.census.steps[] | select(.id == "census") | .run | contains("FLAKE_CENSUS_VERDICT_FILE=census-verdict.txt")' "$doc"
  jq -e '.jobs.census.steps[] | select(.run == "bash scripts/ci/e2e-flake-census-issue.sh")
    | .if == "${{ !cancelled() }}"
      and .env.CENSUS_DRY_RUN == "${{ github.ref == '"'refs/heads/main'"' && '"'0'"' || '"'1'"' }}"' "$doc"
  jq -e '.jobs.census.permissions == {"contents": "read", "issues": "write"} and .permissions == {}' "$doc"
  # A hung burn-in times out as a step, not as the job, so the tracker step still runs.
  jq -e '.jobs.census as $job | $job.steps[] | select((.run // "") | test("test-e2e-burnin"))
    | .["continue-on-error"] == true and .["timeout-minutes"] < $job["timeout-minutes"]' "$doc"
}
