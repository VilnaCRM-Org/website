#!/usr/bin/env bats
#
# Coverage for scripts/ci/graphql-drift.sh (issue #348).
#
# The subject is the THREE-WAY exit contract, not the diff itself: the whole
# reason this script does not simply return "non-zero means drift" is that a
# nightly which reports a network outage as a breaking API change trains every
# reader to ignore it. So each case below drives one of the three outcomes and
# asserts the code, and the "could not run" cases outnumber the others on purpose.
#
# Network is stubbed at `curl`: the upstream releases API and raw.githubusercontent
# are the two things this script talks to, and a test that reached them would be
# testing upstream's uptime. `node` and the real graphql-js comparison helper are
# NOT stubbed — the classification is the part worth exercising for real.

load './test_helper.bash'

SCRIPT="scripts/ci/graphql-drift.sh"

setup() {
  setup_stub_dir

  BASELINE="$BATS_TEST_TMPDIR/baseline.graphql"
  UPSTREAM="$BATS_TEST_TMPDIR/upstream.graphql"
  REPORT_DIR="$BATS_TEST_TMPDIR/reports"
  REPORT="$REPORT_DIR/graphql-drift.md"
  mkdir -p "$REPORT_DIR"

  cat > "$BASELINE" <<'SDL'
type User {
  id: ID!
  email: String!
  confirmed: Boolean!
}

type Query {
  user(id: ID!): User
}
SDL
  cp "$BASELINE" "$UPSTREAM"

  # `curl` sees two shapes: the releases API (stdout) and the raw schema fetch
  # (`-o <file>`). STUB_API_STATUS / STUB_FETCH_STATUS make either one fail.
  cat > "$STUB_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
out=''
url=''
while [ "$#" -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift 2 ;;
    -H) shift 2 ;;
    http*) url="$1"; shift ;;
    *) shift ;;
  esac
done
if [ -n "$out" ]; then
  [ "${STUB_FETCH_STATUS:-0}" -eq 0 ] || exit "$STUB_FETCH_STATUS"
  cp "${STUB_UPSTREAM_FILE:?}" "$out"
  exit 0
fi
case "$url" in
  *api.github.com*)
    [ "${STUB_API_STATUS:-0}" -eq 0 ] || exit "$STUB_API_STATUS"
    printf '{"tag_name": "%s"}\n' "${STUB_LATEST_TAG-v0.8.0}"
    ;;
esac
exit 0
EOF
  chmod +x "$STUB_BIN_DIR/curl"
}

run_drift() {
  run env -C "$PROJECT_ROOT" \
    PATH="$STUB_BIN_DIR:$PATH" \
    GRAPHQL_BASELINE="$BASELINE" \
    GRAPHQL_DRIFT_REPORT="$REPORT" \
    STUB_UPSTREAM_FILE="$UPSTREAM" \
    "$@" \
    bash "$PROJECT_ROOT/$SCRIPT"
}

# --- 0: clean ------------------------------------------------------------------

@test "exits 0 when the upstream release makes no breaking change against the snapshot" {
  run_drift
  [ "$status" -eq 0 ]
  assert_output_contains 'No breaking changes between the snapshot and v0.8.0'
  [ ! -f "$REPORT" ]
}

@test "resolves the newest release from the releases API, not by semver-sorting tags" {
  # Upstream restarted its numbering: v0.8.0 is NEWER than v2.4.1. The script
  # must use the tag the releases API names, whatever a version sort would say.
  run_drift STUB_LATEST_TAG=v0.8.0
  [ "$status" -eq 0 ]
  assert_output_contains 'user-service@v0.8.0'
}

@test "UPSTREAM_REF overrides the release lookup" {
  run_drift UPSTREAM_REF=v9.9.9
  [ "$status" -eq 0 ]
  assert_output_contains 'user-service@v9.9.9'
}

# --- 1: breaking drift ----------------------------------------------------------

@test "exits 1 and writes a report when upstream removed a field" {
  cat > "$UPSTREAM" <<'SDL'
type User {
  id: ID!
  email: String!
}

type Query {
  user(id: ID!): User
}
SDL
  run_drift
  [ "$status" -eq 1 ]
  assert_output_contains 'Breaking changes found'
  grep -F 'FIELD_REMOVED' "$REPORT"
  grep -F 'User.confirmed was removed' "$REPORT"
  grep -F 'advisory' "$REPORT"
  # The verdict is `findBreakingChanges`, so the report must claim breaking
  # drift and not snapshot equality: a non-breaking addition also exits 0.
  grep -F '## Breaking upstream GraphQL drift' "$REPORT"
  grep -F 'reports BREAKING changes only' "$REPORT"
}

@test "a non-breaking upstream addition is not reported as drift" {
  # The boundary between the 0 and 1 lanes: upstream ADDING a field is not a
  # breaking change, and a gate that reddened on it would be noise every release.
  cat > "$UPSTREAM" <<'SDL'
type User {
  id: ID!
  email: String!
  confirmed: Boolean!
  initials: String
}

type Query {
  user(id: ID!): User
}
SDL
  run_drift
  [ "$status" -eq 0 ]
  [ ! -f "$REPORT" ]
}

# --- 2: could not run -----------------------------------------------------------

@test "exits 2 when the releases API is unreachable" {
  run_drift STUB_API_STATUS=7
  [ "$status" -eq 2 ]
  assert_output_contains 'could not reach'
}

@test "exits 2 when the releases API returns no tag" {
  run_drift STUB_LATEST_TAG=
  [ "$status" -eq 2 ]
  assert_output_contains 'could not resolve the latest'
}

@test "exits 2 when the upstream schema cannot be fetched" {
  run_drift STUB_FETCH_STATUS=22
  [ "$status" -eq 2 ]
  assert_output_contains 'has the schema moved'
}

@test "exits 2 when the upstream schema is empty" {
  : > "$UPSTREAM"
  run_drift
  [ "$status" -eq 2 ]
  assert_output_contains 'returned an empty document'
}

@test "exits 2 when the upstream document is not valid SDL" {
  # The dangerous confusion this contract exists to prevent: an unparseable
  # revision must NOT be published as a breaking API change.
  printf 'type User {\n' > "$UPSTREAM"
  run_drift
  [ "$status" -eq 2 ]
  assert_output_contains 'could not compare the schemas'
}

@test "exits 2 when the baseline is missing" {
  rm -f "$BASELINE"
  run_drift
  [ "$status" -eq 2 ]
  assert_output_contains 'is missing or unreadable'
}

@test "exits 2 when the report directory is not writable" {
  # A failed redirection exits 1, which would be indistinguishable from
  # "breaking drift found" — the one confusion the check must never make.
  #
  # Environment guard, not a suppressed assertion: root ignores the write bit,
  # so `chmod a-w` cannot make the directory unwritable and the case has no
  # subject. Every non-root user still runs it and still asserts exit 2.
  [ "$(id -u)" -ne 0 ] || skip 'root ignores the write bit, so the directory cannot be made unwritable'
  chmod a-w "$REPORT_DIR"
  run_drift
  chmod u+w "$REPORT_DIR"
  [ "$status" -eq 2 ]
  assert_output_contains 'cannot write the drift report into'
}
