#!/usr/bin/env bats
#
# The in-repo half of the code-scanning branch-protection contract (issue #383).
#
# Branch protection is repository configuration and cannot be committed: the two
# required status checks for `main` are GitHub's native `CodeQL` check run and
# the `Analyze (typescript)` job of security-testing.yml. What the repo CAN own
# is the contract -- the wiring and the check name -- so that renaming the job,
# dropping the matrix, or losing the exec bit on the gate script fails here
# instead of silently un-gating main.

load './test_helper.bash'

WORKFLOWS_DIR="$PROJECT_ROOT/.github/workflows"

# Print the body of the top-level job $2 from workflow file $1. Job keys sit at a
# two-space indent under `jobs:`, so the next two-space key ends the block. This
# keeps the assertions structural: a step added to a DIFFERENT job of the same
# file cannot satisfy them.
extract_job() {
  awk -v job="  $2:" '
    $0 == job { inside = 1; next }
    inside && /^  [A-Za-z0-9_-]+:/ { inside = 0 }
    inside { print }
  ' "$1"
}

# Print the `permissions:` mapping of the job body on stdin. Job-level keys sit
# at a four-space indent, so the next four-space key ends the block. A comment
# elsewhere in the job -- the gate step explains the grant in prose -- must not
# be able to satisfy a permission assertion.
extract_job_permissions() {
  awk '
    /^    permissions:[[:space:]]*$/ { inside = 1; next }
    inside && /^    [A-Za-z0-9_-]+:/ { inside = 0 }
    inside { print }
  '
}

# Print the code-scanning severity predicate lines shared by the gate script and
# the ci-health-alerts digest, normalised to a single space so indentation
# differences between a shell script and a YAML block scalar do not matter.
extract_severity_predicate() {
  grep -E '^[[:space:]]*\|[[:space:]]*(\(\.rule\.|select\(\$sec)' "$1" |
    sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]\{1,\}/ /g'
}

@test "the analyze job runs the code-scanning gate and the script is executable" {
  local analyze
  analyze="$(extract_job "$WORKFLOWS_DIR/security-testing.yml" analyze)"

  [[ "$analyze" == *'run: ./scripts/ci/code-scanning-gate.sh'* ]]
  # The workflow invokes the path directly, so a lost exec bit is a silent CI
  # break that no YAML assertion would catch.
  [ -x "$PROJECT_ROOT/scripts/ci/code-scanning-gate.sh" ]
}

@test "the gate step is fed entirely through env, never interpolated into run" {
  local analyze
  analyze="$(extract_job "$WORKFLOWS_DIR/security-testing.yml" analyze)"

  [[ "$analyze" == *'EVENT_NAME: ${{ github.event_name }}'* ]]
  [[ "$analyze" == *'PR_NUMBER: ${{ github.event.pull_request.number }}'* ]]
  [[ "$analyze" == *'HEAD_REPO: ${{ github.event.pull_request.head.repo.full_name }}'* ]]
  [[ "$analyze" == *'ANALYSIS_SHA: ${{ github.sha }}'* ]]
  # Script injection guard: the only run: line in the gate step is the bare
  # script invocation, with no ${{ }} anywhere in it.
  [[ "$analyze" != *'run: ./scripts/ci/code-scanning-gate.sh ${{'* ]]
}

@test "the analyze job still produces the required 'Analyze (typescript)' check name" {
  # The required-check name is `name:` + the matrix value. Renaming the job,
  # changing name:, or adding a language renames the check run and GitHub
  # silently stops requiring anything.
  local analyze
  analyze="$(extract_job "$WORKFLOWS_DIR/security-testing.yml" analyze)"

  [[ "$analyze" == *'name: Analyze'* ]]
  [[ "$analyze" == *"language: ['typescript']"* ]]
  # Exactly one language, or the check name gains a sibling and drifts.
  [ "$(grep -c "language: \['typescript'\]" "$WORKFLOWS_DIR/security-testing.yml")" -eq 1 ]
}

@test "the analyze job keeps the security-events permission the gate reads with" {
  local perms
  perms="$(extract_job "$WORKFLOWS_DIR/security-testing.yml" analyze |
    extract_job_permissions)"

  # write subsumes read, so no separate grant is needed -- but losing it would
  # break both the upload and the gate.
  [ -n "$perms" ]
  printf '%s\n' "$perms" | grep -qE '^      security-events: write[[:space:]]*$'
}

@test "ci-health-alerts monitors security testing and ignores pull-request runs" {
  local file="$WORKFLOWS_DIR/ci-health-alerts.yml"

  grep -Fq '      - security testing' "$file"
  # security testing runs on pull_request too; both workflow_run steps must
  # refuse to file or close a tracking issue for a PR run.
  [ "$(grep -c "github.event.workflow_run.event != 'pull_request'" "$file")" -eq 2 ]
  grep -Fq 'security-events: read' "$file"
}

@test "ci-health-alerts keeps the recovery guard and the red-main sweep" {
  local file="$WORKFLOWS_DIR/ci-health-alerts.yml"

  # Out-of-order (stale) success events must not close an issue a newer failed
  # run opened, and the daily red-main sweep must survive this change.
  grep -Fq 'gh run list --workflow "$WORKFLOW_NAME" --branch main --limit 1' "$file"
  grep -Fq 'name: Sweep for a red default branch' "$file"
  grep -Fq "if: github.event_name == 'schedule'" "$file"
}

@test "ci-health-alerts leaves the non-security alert bodies byte-identical" {
  local file="$WORKFLOWS_DIR/ci-health-alerts.yml"

  # The digest is appended as ${suffix}, which is empty for every workflow other
  # than security testing, so the deploy/release wording is unchanged.
  grep -Fq -e 'gh issue comment "$existing" --body "Still failing: ${RUN_URL}${suffix}"' "$file"
  grep -Fq -e '--body "The '"'"'$WORKFLOW_NAME'"'"' workflow failed. Latest run: ${RUN_URL}${suffix}"' "$file"
  grep -Fq 'if [ "$WORKFLOW_NAME" = "security testing" ]; then' "$file"
}

@test "the ci-health-alerts digest uses the same severity predicate as the gate" {
  # Two copies of the blocking-alert rule exist by necessity (ci-health-alerts
  # has no checkout step, so it cannot call the script). Pin them together so a
  # change to one is a visible failure rather than a silent divergence.
  local gate alerts
  gate="$(extract_severity_predicate "$PROJECT_ROOT/scripts/ci/code-scanning-gate.sh")"
  alerts="$(extract_severity_predicate "$WORKFLOWS_DIR/ci-health-alerts.yml")"

  [ -n "$gate" ]
  [ "$gate" = "$alerts" ]
}

@test "every action in the security workflows is pinned to a full commit sha" {
  local file
  for file in "$WORKFLOWS_DIR/security-testing.yml" "$WORKFLOWS_DIR/ci-health-alerts.yml"; do
    run grep -nE '^\s*uses:' "$file"
    if [ "$status" -eq 0 ]; then
      # Every `uses:` line must carry a 40-hex-character ref.
      [ "$(printf '%s\n' "$output" | grep -cvE '@[0-9a-f]{40}' || true)" -eq 0 ]
    fi
  done
}
