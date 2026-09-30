#!/usr/bin/env bats
#
# Coverage for the nightly mutation census tracker (#345, #513): the census
# verdict written by scripts/ci/merge-mutation-reports.ts and the issue lifecycle
# scripts/ci/mutation-census-issue.sh drives from it.
#
# Why this file exists: the tracker step used to comment on the open issue after
# EVERY census and never close it, so #456 collected five clean-run comments,
# #503 was closed by hand, and the next 100% census filed #513. Each end-to-end
# case below runs the REAL merger over a Stryker report fixture and hands its
# verdict to the REAL issue script against a stubbed `gh`, so the outcomes (clean
# closes, findings refresh, measured-nothing stays open and goes red) are proved
# end to end rather than per half.

load './test_helper.bash'

REPO='VilnaCRM-Org/website'
TITLE='mutation testing backlog'
RUN_URL='https://github.com/VilnaCRM-Org/website/actions/runs/1'

# A `gh` double that records argv with the GH_REPO it ran under. `issue list`
# serves FAKE_ISSUE_LIST, or fails like a rate-limited API when FAKE_LIST_FAIL
# is set.
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

# One shard report over one source file, in Stryker's mutation-testing-elements
# shape, with the given mutant statuses (Killed, Survived, NoCoverage, ...).
write_shard() {
  local statuses=("$@") mutants='' status
  for status in "${statuses[@]}"; do
    mutants+="{\"status\":\"$status\"},"
  done
  printf '{"files":{"src/utils/a.ts":{"mutants":[%s]}}}\n' "${mutants%,}" \
    >"$WORK/reports/mutation/mutation-shard-0.json"
}

# The workflow's "Score the census" step: the real merger, run from the work
# directory it treats as the repository root, against the committed policy and
# the advisory full-scope decision `make mutation-file-list` records.
run_merge() {
  (cd "$WORK" &&
    MUTATION_SCOPE=full MUTATION_SHARD_TOTAL=1 \
      bun "$PROJECT_ROOT/scripts/ci/merge-mutation-reports.ts")
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
    bash "$PROJECT_ROOT/scripts/ci/mutation-census-issue.sh"
}

verdict() {
  cat "$WORK/reports/mutation/census-verdict.txt"
}

setup() {
  setup_stub_dir
  create_census_gh_stub
  WORK="$BATS_TEST_TMPDIR/work"
  mkdir -p "$WORK/config" "$WORK/reports/mutation"
  cp "$PROJECT_ROOT/config/mutation-policy.json" "$WORK/config/"
  jq -nc '{mode: "advisory", break: null, reason: "full scope is advisory", scope: "full",
    fileCount: 1, digest: ("0" * 64), unmeasured: []}' >"$WORK/reports/mutation/gate.json"
  OPEN_TRACKER="$(jq -nc --arg t "$TITLE" '[{number: 513, title: $t}]')"
}

# --- the three outcomes ----------------------------------------------------------

@test "a clean census comments the summary and run link on the open tracker, then closes it" {
  write_shard Killed Timeout Ignored
  run_merge
  [ "$(verdict)" = 'clean' ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue comment 513 --body ### Mutation score (\`full\` scope): 100.00%"
  assert_log_contains 'No surviving or uncovered mutants.'
  assert_log_contains "Census run: $RUN_URL"
  assert_log_contains "gh [GH_REPO=$REPO] issue close 513"
  refute_log_contains 'issue create'
}

@test "a clean census closes every open tracker with the exact title" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_ISSUE_LIST="$(jq -nc --arg t "$TITLE" '[{number: 456, title: $t}, {number: 503, title: $t}]')"

  [ "$status" -eq 0 ]
  assert_log_contains 'issue close 456'
  assert_log_contains 'issue close 503'
  refute_log_contains 'issue create'
}

@test "a clean census with no open tracker creates nothing" {
  write_shard Killed Killed
  run_merge

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 0 ]
  assert_output_contains 'no open'
  refute_any_write
}

@test "a clean census never closes a mutation-backlog issue with a different title" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_ISSUE_LIST='[{"number":12,"title":"mutation testing backlog: swagger helpers"}]'

  [ "$status" -eq 0 ]
  refute_log_contains 'issue close'
  refute_log_contains 'issue comment'
}

@test "a census with a surviving mutant refreshes the open tracker and stays green" {
  write_shard Killed Survived
  run_merge
  [ "$(verdict)" = 'findings' ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue comment 513 --body ### Mutation score"
  assert_log_contains '| `src/utils/a.ts` | 1 | 0 |'
  refute_log_contains 'issue close'
  refute_log_contains 'issue create'
}

@test "a census with an uncovered mutant files the tracker when none is open" {
  write_shard Killed NoCoverage
  run_merge
  [ "$(verdict)" = 'findings' ]

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 0 ]
  assert_log_contains "gh [GH_REPO=$REPO] issue create --label mutation-backlog --title $TITLE --body"
  assert_log_contains '| `src/utils/a.ts` | 0 | 1 |'
  refute_log_contains 'issue close'
}

@test "a findings census files a new tracker rather than commenting on a similarly titled issue" {
  printf 'findings\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_ISSUE_LIST='[{"number":12,"title":"mutation testing backlog: swagger helpers"}]'

  [ "$status" -eq 0 ]
  refute_log_contains 'issue comment 12'
  assert_log_contains "issue create --label mutation-backlog --title $TITLE"
}

@test "a merge that throws writes no verdict, and the tracker stays open and fails the run" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"
  run run_merge
  [ "$status" -ne 0 ]
  [ ! -e "$WORK/reports/mutation/census-verdict.txt" ]

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 1 ]
  assert_output_contains '::error::The mutation census recorded no verdict'
  assert_log_contains 'issue comment 513 --body **This census did not measure the mutation backlog.'
  refute_log_contains 'issue close'
}

@test "a missing verdict file reads as measured nothing, never as clean" {
  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 1 ]
  assert_log_contains "issue create --label mutation-backlog --title $TITLE"
  assert_log_contains 'The census produced no summary'
  refute_log_contains 'issue close'
}

@test "an empty verdict file reads as measured nothing" {
  : >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_ISSUE_LIST="$OPEN_TRACKER"

  [ "$status" -eq 1 ]
  assert_log_contains 'issue comment 513'
  refute_log_contains 'issue close'
}

@test "a summary over the body cap is truncated with a pointer to the artifact" {
  printf 'findings\n' >"$WORK/reports/mutation/census-verdict.txt"
  head -c 70000 /dev/zero | tr '\0' 'x' >"$WORK/reports/mutation/summary.md"

  run_tracker FAKE_ISSUE_LIST='[]'

  [ "$status" -eq 0 ]
  assert_log_contains "_Table truncated; the full report is in this run's artifact._"
  [ "$(grep -o 'x*' "$COMMAND_LOG" | awk '{ if (length > max) max = length } END { print max }')" -eq 60000 ]
}

# --- failure modes and guards ------------------------------------------------------

@test "an unknown verdict is refused before any gh call" {
  printf 'green\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker

  [ "$status" -eq 2 ]
  assert_output_contains "unknown census verdict 'green'"
  [ ! -s "$COMMAND_LOG" ]
}

@test "a failed lookup on a findings census fails rather than filing a duplicate" {
  printf 'findings\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_LIST_FAIL=1

  [ "$status" -ne 0 ]
  refute_log_contains 'issue create'
}

@test "a failed lookup on a clean census warns and leaves the run green" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"

  run_tracker FAKE_LIST_FAIL=1

  [ "$status" -eq 0 ]
  assert_output_contains '::warning::could not list open mutation-backlog issues'
  refute_any_write
}

@test "a dry run reads but never writes, and still fails a census that measured nothing" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"
  run_tracker CENSUS_DRY_RUN=1 FAKE_ISSUE_LIST="$OPEN_TRACKER"
  [ "$status" -eq 0 ]
  assert_output_contains 'dry run -- would close #513'
  refute_any_write

  printf 'findings\n' >"$WORK/reports/mutation/census-verdict.txt"
  reset_command_log
  run_tracker CENSUS_DRY_RUN=1 FAKE_ISSUE_LIST='[]'
  [ "$status" -eq 0 ]
  assert_output_contains "dry run -- would create '$TITLE' (findings)"
  refute_any_write

  rm "$WORK/reports/mutation/census-verdict.txt"
  reset_command_log
  run_tracker CENSUS_DRY_RUN=1 FAKE_ISSUE_LIST="$OPEN_TRACKER"
  [ "$status" -eq 1 ]
  assert_output_contains 'dry run -- would comment on #513 (unmeasured)'
  refute_any_write
}

@test "exits 2 without a repository context, before any gh call" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"
  run env -u GH_REPO -u GITHUB_REPOSITORY -C "$WORK" \
    PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" RUN_URL="$RUN_URL" \
    bash "$PROJECT_ROOT/scripts/ci/mutation-census-issue.sh"

  [ "$status" -eq 2 ]
  assert_output_contains 'GH_REPO or GITHUB_REPOSITORY must be set'
  [ ! -s "$COMMAND_LOG" ]
}

@test "exits 2 without a run URL, before any gh call" {
  printf 'clean\n' >"$WORK/reports/mutation/census-verdict.txt"
  run env -u RUN_URL -C "$WORK" \
    PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" GITHUB_REPOSITORY="$REPO" \
    bash "$PROJECT_ROOT/scripts/ci/mutation-census-issue.sh"

  [ "$status" -eq 2 ]
  assert_output_contains 'RUN_URL must be set'
  [ ! -s "$COMMAND_LOG" ]
}

# --- workflow wiring -----------------------------------------------------------------

@test "the census-report job hands the verdict to the tracker script exactly once and gates writes on main" {
  local doc="$BATS_TEST_TMPDIR/mutation.json"
  node -e '
    const yaml = require(process.argv[2] + "/node_modules/js-yaml");
    const fs = require("fs");
    process.stdout.write(JSON.stringify(yaml.load(fs.readFileSync(process.argv[1], "utf8"))));
  ' "$PROJECT_ROOT/.github/workflows/mutation-testing.yml" "$PROJECT_ROOT" >"$doc"

  # Exactly one step runs the tracker script, and nothing else in the workflow
  # touches issues.
  [ "$(jq '[.jobs[].steps[] | select((.run // "") == "bash scripts/ci/mutation-census-issue.sh")] | length' "$doc")" -eq 1 ]
  [ "$(jq '[.jobs[].steps[] | select((.run // "") | test("gh (issue|label)"))] | length' "$doc")" -eq 0 ]

  jq -e '.jobs["census-report"].steps[] | select(.run == "bash scripts/ci/mutation-census-issue.sh")
    | .if == "${{ !cancelled() }}"
      and .env.GH_TOKEN == "${{ github.token }}"
      and .env.GH_REPO == "${{ github.repository }}"
      and .env.RUN_URL == "${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
      and .env.CENSUS_DRY_RUN == "${{ github.ref == '"'refs/heads/main'"' && '"'0'"' || '"'1'"' }}"' "$doc"
  jq -e '.jobs["census-report"].steps[] | select((.run // "") | contains("merge-mutation-reports MUTATION_SCOPE=full"))' "$doc"
  jq -e '.jobs["census-report"].steps[] | select(.uses // "" | startswith("actions/upload-artifact@"))
    | .with.path | split("\n") | index("reports/mutation/census-verdict.txt") != null' "$doc"
  jq -e '.jobs["census-report"].permissions == {"contents": "read", "issues": "write"}
    and .jobs.census.permissions == {"contents": "read"} and .permissions == {}' "$doc"
}
