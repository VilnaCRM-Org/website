#!/usr/bin/env bats
#
# Coverage for scripts/ci/smoke-response-shape.sh (issue #363).
#
# Every CloudFront production incident this repository has had was on the negative
# path — 500 instead of 404 (#226, and again #229), a 404 Safari downloaded
# because it carried no content-type (#235), and a synthetic response with no body
# that CloudFront turned into a 5xx (#249). The deploy smoke that existed before
# this script asserted 200 on `/` and `/swagger`, which misses all four.
#
# So each case below seeds exactly one of those incident shapes into a real origin
# and asserts the script goes red on it. The origin is a real HTTP server
# (tests/bats/fixtures/smoke-origin.mjs) rather than a `curl` stub: the subject is
# what comes back over the wire, and a stub would only ever test the stub.

load './test_helper.bash'

SCRIPT="scripts/ci/smoke-response-shape.sh"

setup() {
  ORIGIN_CONFIG="$BATS_TEST_TMPDIR/origin.json"
  ORIGIN_LOG="$BATS_TEST_TMPDIR/origin.log"
  ORIGIN_PID=''
}

teardown() {
  if [ -n "${ORIGIN_PID:-}" ]; then
    kill "$ORIGIN_PID" 2>/dev/null || true
    wait "$ORIGIN_PID" 2>/dev/null || true
  fi
}

# Boot the fixture origin on an OS-chosen port and export its base URL.
start_origin() {
  cat > "$ORIGIN_CONFIG"

  node "$PROJECT_ROOT/tests/bats/fixtures/smoke-origin.mjs" "$ORIGIN_CONFIG" \
    > "$ORIGIN_LOG" 2>&1 &
  ORIGIN_PID=$!

  local port=''
  for _ in $(seq 1 50); do
    port="$(sed -n 's/^PORT=//p' "$ORIGIN_LOG" | head -n 1)"
    [ -n "$port" ] && break
    sleep 0.1
  done
  [ -n "$port" ] || {
    echo 'the fixture origin never reported a port' >&2
    cat "$ORIGIN_LOG" >&2
    return 1
  }
  BASE_URL="http://127.0.0.1:${port}"
}

run_smoke() {
  run env -C "$PROJECT_ROOT" \
    SMOKE_ATTEMPTS="${SMOKE_ATTEMPTS:-1}" \
    SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL" "$@"
}

# The response shape a correctly deployed distribution returns for an unknown path.
GOOD_404='{"status":404,"headers":{"content-type":"text/html; charset=utf-8"},"body":"<html><body>404</body></html>"}'

# --- The happy path -------------------------------------------------------------

@test "passes on a well-formed synthetic 404" {
  start_origin <<< "$GOOD_404"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
}

@test "requires a base URL" {
  BASE_URL=''
  run env -C "$PROJECT_ROOT" bash "$PROJECT_ROOT/$SCRIPT"
  [ "$status" -eq 2 ]
  assert_output_contains 'usage: smoke-response-shape.sh'
}

@test "strips a trailing slash rather than probing a double slash" {
  # `//smoke-nonexistent` is a different URI to CloudFront than the one the
  # routing handler is written against, so the probe would grade the wrong path.
  start_origin <<< "$GOOD_404"
  BASE_URL="${BASE_URL}/"
  run_smoke
  [ "$status" -eq 0 ]
  refute_output_contains '//smoke-nonexistent'
}

# --- The four production incidents ----------------------------------------------

@test "fails when the origin answers 500 instead of 404 (#226, #229)" {
  start_origin <<< '{"status":500,"headers":{"content-type":"text/html"},"body":"boom"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 404, got 500'
}

@test "fails when an unknown path is served a 200 instead of the site 404" {
  # The other direction of the same assertion: a 200 means the edge allow-list has
  # stopped fail-closing and the bucket is answering for a path it should not.
  start_origin <<< '{"status":200,"headers":{"content-type":"text/html"},"body":"leaked"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 404, got 200'
}

@test "fails when the 404 carries an empty body (#249)" {
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html"},"body":""}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'expected a non-empty 404 page'
}

@test "fails when the 404 carries no content-type (#235)" {
  # This is the header whose absence made Safari download the 404 rather than
  # render it. `null` removes the one Node would otherwise add.
  start_origin <<< '{"status":404,"headers":{"content-type":null},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'content-type: expected text/html'
}

@test "fails when the 404 is served as a non-HTML content type" {
  start_origin <<< '{"status":404,"headers":{"content-type":"application/json"},"body":"{}"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains "got 'application/json'"
}

@test "accepts a spec-legal uppercase media type" {
  # RFC 9110 media types and subtypes are case-insensitive. This is the BLOCKING
  # half of the script, so reading `TEXT/HTML` as wrong would redden a production
  # deploy on a response that is actually correct.
  start_origin <<< '{"status":404,"headers":{"content-type":"TEXT/HTML; charset=UTF-8"},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
}

@test "accepts a correct content-type that arrives after a wrong duplicate" {
  # A response can carry a header twice — an origin value plus one the response-
  # headers policy adds. Grading only the first copy fails a correct response.
  start_origin <<< '{"status":404,"headers":{"content-type":["application/json","text/html; charset=utf-8"]},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
}

@test "fails when the origin cannot be reached at all" {
  # An unroutable port: curl never connects, so there is no status to grade and
  # the script must report that rather than treat silence as success.
  BASE_URL='http://127.0.0.1:1'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 404, got 000'
  # curl writes its %{http_code} even on a transport failure AND exits non-zero,
  # so a naive `|| echo 000` fallback would print the code twice.
  refute_output_contains '000000'
}

@test "reports every gap in the same response, not just the first" {
  start_origin <<< '{"status":500,"headers":{"content-type":null},"body":""}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 404, got 500'
  assert_output_contains 'expected a non-empty 404 page'
  assert_output_contains 'content-type: expected text/html'
}

# --- Propagation ------------------------------------------------------------------

@test "retries until the deployed distribution catches up" {
  # CodePipeline deploys asynchronously and a function association propagates on
  # its own schedule, so an early miss must not be the verdict.
  start_origin <<< "[{\"status\":500,\"body\":\"not ready\"},{\"status\":500,\"body\":\"not ready\"},${GOOD_404}]"
  SMOKE_ATTEMPTS=5 run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'not ready (attempt 1/5)'
  assert_output_contains 'returned a well-formed 404'
}

@test "gives up after the configured number of attempts" {
  start_origin <<< '{"status":500,"body":"still broken"}'
  SMOKE_ATTEMPTS=3 run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'attempt 3/3'
}

# --- Advisory: the CloudFront response-headers policy ------------------------------

@test "warns, but does not fail, when the 404 is missing a policy header" {
  # Two things can put a header on this response — the viewer-request function in
  # this repository and the infra repository's response-headers policy — and from
  # outside there is no telling which one is missing, so a first landing that
  # blocked would risk reddening every deploy for a cause this repo may not own.
  start_origin <<< "$GOOD_404"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains '::warning::'
  assert_output_contains 'content-security-policy'
  assert_output_contains 'put it on the synthetic 404'
}

@test "stays quiet when the 404 carries the whole policy" {
  local headers
  headers="$(jq -c '.headers | to_entries | map({(.key): .value}) | add + {"content-type":"text/html"}' \
    "$PROJECT_ROOT/config/security-headers.json")"
  start_origin <<< "{\"status\":404,\"headers\":${headers},\"body\":\"<html>404</html>\"}"
  run_smoke
  [ "$status" -eq 0 ]
  refute_output_contains 'put it on the synthetic 404'
}

@test "reads the header names from the committed policy, not a second copy" {
  # The one source of truth is config/security-headers.json, shared with
  # `make lint-headers` and the deploy workflow's positive-path check. Pointing
  # the script at a different policy must change what it looks for.
  local policy="$BATS_TEST_TMPDIR/policy.json"
  printf '%s\n' '{"headers":{"x-made-up-header":"1"}}' > "$policy"
  start_origin <<< "$GOOD_404"
  run env -C "$PROJECT_ROOT" \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    SECURITY_HEADERS_POLICY="$policy" \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL"
  [ "$status" -eq 0 ]
  assert_output_contains 'x-made-up-header'
  refute_output_contains 'content-security-policy'
}

@test "says so when jq is missing rather than dropping the advisory silently" {
  # Process substitution swallows a missing jq: the loop reads nothing and the
  # whole header advisory disappears without a word.
  start_origin <<< "$GOOD_404"
  run env -C "$PROJECT_ROOT" \
    JQ_BIN=jq-that-is-not-installed \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL"
  [ "$status" -eq 0 ]
  assert_output_contains 'jq-that-is-not-installed is not installed'
  refute_output_contains 'put it on the synthetic 404'
}

@test "says so when the policy is not valid JSON rather than dropping the advisory" {
  # `[ -r ... ]` proves the file is readable, not parseable. A truncated policy
  # would otherwise feed the loop zero lines and delete the whole advisory at rc 0.
  local policy="$BATS_TEST_TMPDIR/broken.json"
  printf '%s' '{"headers": {' > "$policy"
  start_origin <<< "$GOOD_404"
  run env -C "$PROJECT_ROOT" \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    SECURITY_HEADERS_POLICY="$policy" \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL"
  [ "$status" -eq 0 ]
  assert_output_contains 'is not valid JSON'
  refute_output_contains 'put it on the synthetic 404'
}

@test "says so when the policy declares no headers at all" {
  local policy="$BATS_TEST_TMPDIR/empty.json"
  printf '%s' '{"headers":{}}' > "$policy"
  start_origin <<< "$GOOD_404"
  run env -C "$PROJECT_ROOT" \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    SECURITY_HEADERS_POLICY="$policy" \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL"
  [ "$status" -eq 0 ]
  assert_output_contains 'declares no headers'
}

@test "warns rather than crashing when the policy file is unreadable" {
  start_origin <<< "$GOOD_404"
  run env -C "$PROJECT_ROOT" \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    SECURITY_HEADERS_POLICY="$BATS_TEST_TMPDIR/does-not-exist.json" \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL"
  [ "$status" -eq 0 ]
  assert_output_contains 'skipped the header advisory'
}

# --- Advisory: sandbox origins must not be indexable --------------------------------

@test "warns when a sandbox origin is not noindexed" {
  start_origin <<< "$GOOD_404"
  run_smoke --expect-noindex
  [ "$status" -eq 0 ]
  assert_output_contains 'is not noindexed'
}

@test "accepts a sandbox origin that sets X-Robots-Tag: noindex" {
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html","x-robots-tag":"noindex, nofollow"},"body":"<html>404</html>"}'
  run_smoke --expect-noindex
  [ "$status" -eq 0 ]
  assert_output_contains 'carries X-Robots-Tag: noindex, nofollow'
}

@test "does not ask a production origin for noindex" {
  # Production must stay indexable, so the check is opt-in per call site rather
  # than something the script decides for itself.
  start_origin <<< "$GOOD_404"
  run_smoke
  [ "$status" -eq 0 ]
  refute_output_contains 'noindex'
}
