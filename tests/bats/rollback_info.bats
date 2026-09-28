#!/usr/bin/env bats
#
# Coverage for scripts/ci/rollback-info.sh and the `make rollback-info` target
# (issue #329): the host-only helper that names the last commit whose
# production deploy job succeeded, read from the GitHub Deployments API.
#
# The real thing needs `gh` and the network, so every case here runs against a
# PATH-stubbed gh serving canned deployments and statuses. The cases that
# matter most are the negative ones: a newest deployment that FAILED must be
# skipped in favour of the older green one (that is exactly the situation in
# which somebody runs this), and each "cannot answer" condition must exit with
# its own code and message rather than printing nothing.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/rollback-info.sh'

# A `gh` double: `auth status` honours FAKE_GH_UNAUTHENTICATED, the deployments
# listing replays FAKE_DEPLOYMENTS, and each deployment's statuses replay the
# file $FAKE_STATUS_DIR/<deployment id>.json (an unmapped id is a 404).
create_rollback_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'STUB'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >> "${COMMAND_LOG:?}"

case "${1:-}" in
  auth)
    if [ -n "${FAKE_GH_UNAUTHENTICATED:-}" ]; then
      echo 'You are not logged into any GitHub hosts.' >&2
      exit 1
    fi
    exit 0
    ;;
  api)
    endpoint="${2:-}"
    case "$endpoint" in
      */deployments/*/statuses)
        id="${endpoint#*/deployments/}"
        id="${id%%/*}"
        if [ -f "${FAKE_STATUS_DIR:-/nonexistent}/$id.json" ]; then
          cat "$FAKE_STATUS_DIR/$id.json"
          exit 0
        fi
        echo 'gh: Not Found (HTTP 404)' >&2
        exit 1
        ;;
      */deployments\?*)
        if [ -n "${FAKE_DEPLOYMENTS_FAIL:-}" ]; then
          echo 'gh: 503 Service Unavailable' >&2
          exit 1
        fi
        printf '%s' "${FAKE_DEPLOYMENTS:-[]}"
        exit 0
        ;;
    esac
    echo "unexpected endpoint: $endpoint" >&2
    exit 1
    ;;
esac
exit 0
STUB

  chmod +x "$STUB_BIN_DIR/gh"
}

# $1 id, $2 sha, $3 ref. Newest first is the API's order, so callers list the
# newest deployment first.
deployment() {
  jq -nc --argjson id "$1" --arg sha "$2" --arg ref "$3" \
    '{id: $id, sha: $sha, ref: $ref, environment: "production"}'
}

deployments() {
  jq -nc --slurpfile items <(printf '%s\n' "$@") '$items'
}

# $1 id, then one `<state>|<created_at>|<log_url>` per status, newest first.
write_statuses() {
  local id="$1"
  shift
  printf '%s\n' "$@" |
    jq -Rnc '[inputs | split("|") | {state: .[0], created_at: .[1], log_url: .[2]}]' \
      >"$FAKE_STATUS_DIR/$id.json"
}

run_rollback_info() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    FAKE_STATUS_DIR="$FAKE_STATUS_DIR" \
    GH_REPO='VilnaCRM-Org/website' \
    "$@" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

setup() {
  setup_stub_dir
  create_rollback_gh_stub

  FAKE_STATUS_DIR="$BATS_TEST_TMPDIR/statuses"
  mkdir -p "$FAKE_STATUS_DIR"

  # The shape the real API returned on 2026-09-11: the newest deployment
  # (8f21573c) carries in_progress then success; an older one likewise.
  GREEN_RUN='https://github.com/VilnaCRM-Org/website/actions/runs/34411281650/job/102666020464'
}

@test "prints the newest deployment that reached state success" {
  write_statuses 6360366392 \
    "success|2026-09-09T22:15:40Z|$GREEN_RUN" \
    'in_progress|2026-09-09T22:15:26Z|https://example.test/job'

  run_rollback_info FAKE_DEPLOYMENTS="$(deployments \
    "$(deployment 6360366392 8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb main)")"

  [ "$status" -eq 0 ]
  assert_output_contains 'Last successful production deployment (deployment 6360366392)'
  assert_output_contains 'commit:   8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb'
  assert_output_contains 'ref:      main'
  assert_output_contains 'deployed: 2026-09-09T22:15:40Z'
  assert_output_contains "run:      $GREEN_RUN"
  # The caveat is part of the output, not only of the docs.
  assert_output_contains 'the deploy job finished triggering CodePipeline'
  assert_log_contains 'gh api repos/VilnaCRM-Org/website/deployments?environment=production&per_page=20'
}

@test "skips a newer deployment whose job failed and names the last green one" {
  # This is the rollback situation: the newest deployment is the broken one.
  write_statuses 700 \
    'failure|2026-09-10T10:00:30Z|https://example.test/broken' \
    'in_progress|2026-09-10T10:00:01Z|https://example.test/broken'
  write_statuses 600 \
    "success|2026-09-09T22:15:40Z|$GREEN_RUN" \
    'in_progress|2026-09-09T22:15:26Z|https://example.test/job'

  run_rollback_info FAKE_DEPLOYMENTS="$(deployments \
    "$(deployment 700 deadbeefdeadbeefdeadbeefdeadbeefdeadbeef main)" \
    "$(deployment 600 8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb main)")"

  [ "$status" -eq 0 ]
  assert_output_contains 'commit:   8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb'
  refute_output_contains 'deadbeef'
  assert_log_contains 'deployments/700/statuses'
  assert_log_contains 'deployments/600/statuses'
}

@test "a deployment still in progress is not reported as the last good one" {
  write_statuses 700 'in_progress|2026-09-10T10:00:01Z|https://example.test/running'
  write_statuses 600 "success|2026-09-09T22:15:40Z|$GREEN_RUN"

  run_rollback_info FAKE_DEPLOYMENTS="$(deployments \
    "$(deployment 700 cafebabecafebabecafebabecafebabecafebabe main)" \
    "$(deployment 600 8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb main)")"

  [ "$status" -eq 0 ]
  assert_output_contains 'commit:   8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb'
  refute_output_contains 'cafebabe'
}

@test "exits 4 with a clear message when no deployment exists" {
  run_rollback_info FAKE_DEPLOYMENTS='[]'

  [ "$status" -eq 4 ]
  assert_output_contains "no deployment is recorded for environment 'production'"
  refute_output_contains 'commit:'
}

@test "exits 4 when every recorded deployment failed" {
  write_statuses 700 'failure|2026-09-10T10:00:30Z|https://example.test/broken'
  write_statuses 600 'failure|2026-09-09T22:15:40Z|https://example.test/also-broken'

  run_rollback_info FAKE_DEPLOYMENTS="$(deployments \
    "$(deployment 700 deadbeefdeadbeefdeadbeefdeadbeefdeadbeef main)" \
    "$(deployment 600 0badf00d0badf00d0badf00d0badf00d0badf00d main)")"

  [ "$status" -eq 4 ]
  assert_output_contains "none of the 2 most recent 'production' deployment(s) reached state success"
  refute_output_contains 'commit:'
}

@test "exits 2 when gh is not installed, before touching the network" {
  # A PATH holding only the stub directory with no gh in it: `command -v gh`
  # must fail regardless of what the developer's machine has installed.
  local bash_bin
  bash_bin="$(command -v bash)"
  rm -f "$STUB_BIN_DIR/gh"
  run env PATH="$STUB_BIN_DIR" COMMAND_LOG="$COMMAND_LOG" \
    "$bash_bin" "$PROJECT_ROOT/$SCRIPT_REL"

  [ "$status" -eq 2 ]
  assert_output_contains 'gh is not installed'
  [ ! -s "$COMMAND_LOG" ]
}

@test "exits 3 when gh is installed but not authenticated" {
  run_rollback_info FAKE_GH_UNAUTHENTICATED=1 FAKE_DEPLOYMENTS='[{"id":1}]'

  [ "$status" -eq 3 ]
  assert_output_contains 'gh is not authenticated'
  # It stops at the auth check; the deployments API is never asked.
  assert_log_contains 'gh auth status'
  run grep -F 'gh api' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "exits 5 when the deployments API cannot be read" {
  run_rollback_info FAKE_DEPLOYMENTS_FAIL=1

  [ "$status" -eq 5 ]
  assert_output_contains "could not list deployments for environment 'production'"
  assert_output_contains '503 Service Unavailable'
}

@test "exits 5 when a deployment's statuses cannot be read" {
  # No statuses file for 700: the stub answers 404, and the script must say so
  # rather than silently treating the deployment as failed.
  run_rollback_info FAKE_DEPLOYMENTS="$(deployments \
    "$(deployment 700 deadbeefdeadbeefdeadbeefdeadbeefdeadbeef main)")"

  [ "$status" -eq 5 ]
  assert_output_contains 'could not read the statuses of deployment 700'
}

@test "honours ROLLBACK_ENVIRONMENT and ROLLBACK_DEPLOYMENTS_LIMIT" {
  run_rollback_info FAKE_DEPLOYMENTS='[]' ROLLBACK_ENVIRONMENT=sandbox ROLLBACK_DEPLOYMENTS_LIMIT=5

  [ "$status" -eq 4 ]
  assert_log_contains 'deployments?environment=sandbox&per_page=5'
}

@test "the script only ever reads: no version-control call and no gh mutation" {
  run grep -nE '(^|[;&|(]|[[:space:]])git([[:space:]]|$)' "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -ne 0 ]
  run grep -nE 'gh (issue|pr|release|api -X|api --method|workflow run)' "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -ne 0 ]
  [ -x "$PROJECT_ROOT/$SCRIPT_REL" ]
}

@test "make rollback-info runs the script on the host without Docker or the package manager" {
  setup_makefile_test_env
  create_rollback_gh_stub
  write_statuses 6360366392 "success|2026-09-09T22:15:40Z|$GREEN_RUN"

  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    FAKE_STATUS_DIR="$FAKE_STATUS_DIR" \
    FAKE_DEPLOYMENTS="$(deployments \
      "$(deployment 6360366392 8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb main)")" \
    GH_REPO='VilnaCRM-Org/website' \
    make -C "$MAKEFILE_SANDBOX" rollback-info BIN_DIR="$STUB_BIN_DIR"

  [ "$status" -eq 0 ]
  assert_output_contains 'commit:   8f21573c8a8bc4e717c7b5a55c5d9436e9d928bb'
  assert_log_contains 'gh api repos/VilnaCRM-Org/website/deployments'
  run grep -E '^(docker|bun|npm) ' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}
