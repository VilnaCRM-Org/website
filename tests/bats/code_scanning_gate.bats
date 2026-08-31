#!/usr/bin/env bats
#
# Coverage for scripts/ci/code-scanning-gate.sh (issue #383) -- the backstop that
# fails `security testing` on NEW blocking CodeQL alerts. It only ever runs
# against the live code-scanning API, so every branch here is driven through a
# `gh api` double that applies the script's own --jq filter, with the real jq, to
# fixture alert payloads. The severity predicate is therefore executed rather
# than asserted as a string.

load './test_helper.bash'

setup() {
  setup_code_scanning_gate_env
}

alerts_map() {
  # "<ref>=<fixture>" pairs consumed by the gh double.
  local pairs=""
  local pair
  for pair in "$@"; do
    pairs+="${pair}"$'\n'
  done
  export GH_ALERTS_FIXTURES="$pairs"
}

@test "skips a fork pull request with a notice instead of failing" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-new.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=contributor/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 0 ]
  assert_output_contains '::notice::Code-scanning gate skipped'
  assert_output_contains 'contributor/website'
  # The fork skip must happen before any API call: a fork token cannot read
  # code-scanning, so even attempting it would red an external contributor.
  [ ! -s "$COMMAND_LOG" ]
}

@test "queries the pull request merge ref and the default branch baseline" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-inherited-only.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 0 ]
  assert_log_contains 'ref=refs/pull/9/merge'
  assert_log_contains 'ref=refs/heads/main'
  assert_log_contains 'tool_name=CodeQL'
  assert_log_contains 'state=open'
}

@test "passes when every blocking alert is inherited from the default branch" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-inherited-only.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  # Alert 7 is error/high and open on BOTH refs; inherited debt must not fail
  # somebody else's pull request.
  [ "$status" -eq 0 ]
  assert_output_contains 'No new blocking code-scanning alerts'
}

@test "ignores medium and low severity alerts introduced by the pull request" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-non-blocking.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  # Both alerts are new (the baseline is empty) but neither is high/critical nor
  # rule-severity error.
  [ "$status" -eq 0 ]
  assert_output_contains 'No new blocking code-scanning alerts'
}

@test "fails on a new critical alert introduced by the pull request" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-new.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 1 ]
  assert_output_contains '**critical** `js/sql-injection` in `src/e.ts`'
  assert_output_contains '::error::2 new high/critical code-scanning alert(s)'
}

@test "fails on a new error-severity alert that carries no security severity" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-new.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 1 ]
  # security_severity_level is null; rule.severity == error alone must block, and
  # the reported label falls back to the rule severity.
  assert_output_contains '**error** `js/incomplete-sanitization` in `src/f.ts`'
}

@test "excludes the inherited and non-blocking alerts from the failure list" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-new.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 1 ]
  # 7 is inherited from main, 13 is medium: only 11 and 12 are reported.
  [[ "$output" != *'js/xss'* ]]
  [[ "$output" != *'js/regex-injection'* ]]
}

@test "writes the blocking alerts to the GitHub step summary as a markdown list" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-new.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 1 ]

  local summary
  summary="$(cat "$GITHUB_STEP_SUMMARY")"
  [[ "$summary" == *'### Code scanning gate — FAILED'* ]]
  [[ "$summary" == *'2 new blocking alert(s) on `refs/pull/9/merge`'* ]]
  [[ "$summary" == *'- **critical** `js/sql-injection` in `src/e.ts` ([alert #11]'* ]]
  [[ "$summary" == *'/security/code-scanning/11)'* ]]
}

@test "records a clean run in the GitHub step summary too" {
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-inherited-only.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 0 ]
  grep -Fq 'No new high/critical code-scanning alerts on `refs/pull/9/merge`.' \
    "$GITHUB_STEP_SUMMARY"
}

@test "fails on the default branch without subtracting a baseline" {
  export GH_ANALYSES_FIXTURE="$CODE_SCANNING_FIXTURES/analyses-main.json"
  alerts_map "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=push ANALYSIS_SHA=MAINSHA
  # No baseline on main, so the open error/high alert 7 fails the run -- this is
  # the signal ci-health-alerts.yml turns into a tracking issue.
  [ "$status" -eq 1 ]
  assert_output_contains '1 new blocking alert(s) on `refs/heads/main`'
  assert_output_contains '**high** `js/xss` in `src/a.ts`'
  assert_log_contains 'ref=refs/heads/main'
  [ "$(grep -c 'code-scanning/alerts' "$COMMAND_LOG" || true)" -eq 1 ]
}

@test "accepts the pull request head sha as well as the merge sha" {
  export GH_ANALYSES_FIXTURE="$CODE_SCANNING_FIXTURES/analyses-pr-head-sha.json"
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-inherited-only.json" \
    "refs/heads/main=$CODE_SCANNING_FIXTURES/main-alerts.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA HEAD_SHA=HEADSHA
  [ "$status" -eq 0 ]
  assert_output_contains 'No new blocking code-scanning alerts'
}

@test "fails, bounded, when no CodeQL analysis appears within the poll budget" {
  export GH_ANALYSES_FIXTURE="$CODE_SCANNING_FIXTURES/analyses-empty.json"
  alerts_map "refs/pull/9/merge=$CODE_SCANNING_FIXTURES/pr-alerts-inherited-only.json"

  run_code_scanning_gate EVENT_NAME=pull_request PR_NUMBER=9 \
    HEAD_REPO=VilnaCRM-Org/website ANALYSIS_SHA=MERGESHA
  [ "$status" -eq 1 ]
  assert_output_contains '::error::No CodeQL analysis for refs/pull/9/merge'
  # The poll is bounded: exactly POLL_ATTEMPTS (2) analyses calls, then it stops.
  [ "$(grep -c 'code-scanning/analyses' "$COMMAND_LOG" || true)" -eq 2 ]
  [ "$(grep -c 'code-scanning/alerts' "$COMMAND_LOG" || true)" -eq 0 ]
}

@test "refuses to run without the environment it needs" {
  run env -i PATH="$STUB_BIN_DIR:$PATH" \
    "$PROJECT_ROOT/scripts/ci/code-scanning-gate.sh"
  [ "$status" -ne 0 ]
  assert_output_contains 'GH_TOKEN is required'
}
