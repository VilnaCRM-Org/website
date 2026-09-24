#!/usr/bin/env bats
#
# Coverage for scripts/ci/uptime-check.sh (issue #336).
#
# The script is the positive half of the scheduled synthetic check, and of
# `make smoke-prod` (issue #329): `/` and `/swagger` must each answer 200, as
# text/html, with a body that carries the page's own marker. Every case below
# seeds one way that contract can break into a real origin and asserts the script
# goes red on it — and, just as important, that it stays green on the shapes a
# healthy CDN legitimately produces (an uppercase media type, a charset
# parameter, a response header repeated with the same value), because a false
# alarm every thirty minutes is how an incident issue gets muted.
#
# The origin is a real HTTP server (tests/bats/fixtures/uptime-origin.mjs) rather
# than a `curl` stub: the subject is what comes back over the wire, and a stub
# would only ever test the stub.

load './test_helper.bash'

SCRIPT="scripts/ci/uptime-check.sh"

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

# Boot the fixture origin on an OS-chosen port and export its base URL. The
# config on stdin is a JSON object keyed by path; a path it does not name answers
# the site 404.
start_origin() {
  cat > "$ORIGIN_CONFIG"

  node "$PROJECT_ROOT/tests/bats/fixtures/uptime-origin.mjs" "$ORIGIN_CONFIG" \
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

run_uptime() {
  run env -C "$PROJECT_ROOT" \
    UPTIME_ATTEMPTS="${UPTIME_ATTEMPTS:-1}" \
    UPTIME_DELAY=0 \
    bash "$PROJECT_ROOT/$SCRIPT" "$BASE_URL" "$@"
}

# The two documents a healthy deployment serves.
HOME_OK='{"status":200,"headers":{"content-type":"text/html; charset=utf-8"},"body":"<html><body>__next</body></html>"}'
SWAGGER_OK='{"status":200,"headers":{"content-type":"text/html; charset=utf-8"},"body":"<html><body>swagger</body></html>"}'
HEALTHY="{\"/\":${HOME_OK},\"/swagger\":${SWAGGER_OK}}"

# --- The happy path -------------------------------------------------------------

@test "passes when / and /swagger both answer 200 text/html with a body" {
  start_origin <<< "$HEALTHY"
  run_uptime
  [ "$status" -eq 0 ]
  assert_output_contains 'homepage'
  assert_output_contains 'swagger page'
  [ "$(printf '%s\n' "$output" | grep -c 'returned 200 text/html with a body')" -eq 2 ]
  refute_output_contains '::error::'
}

@test "requires a base URL" {
  BASE_URL=''
  run env -C "$PROJECT_ROOT" bash "$PROJECT_ROOT/$SCRIPT"
  [ "$status" -eq 2 ]
  assert_output_contains 'usage: uptime-check.sh'
}

@test "strips a trailing slash rather than probing a double slash" {
  # `//swagger` is a different URI to CloudFront than the one the routing handler
  # is written against, so the probe would grade the wrong path.
  start_origin <<< "$HEALTHY"
  BASE_URL="${BASE_URL}/"
  run_uptime
  [ "$status" -eq 0 ]
  refute_output_contains '//swagger'
}

# --- Each way the contract can break --------------------------------------------

@test "fails when the homepage answers 500" {
  start_origin <<< "{\"/\":{\"status\":500,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"boom\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'homepage'
  assert_output_contains 'expected 200, got 500'
  # The 500 carried a body. `curl --fail` would have discarded it before the
  # grade ran and reported an empty page the origin never sent.
  refute_output_contains 'expected a non-empty page'
}

@test "probes /swagger as well, not only the homepage" {
  # Only `/` is configured, so the fixture answers the site 404 for `/swagger` —
  # the shape of a deploy that dropped the API docs while the landing stayed up.
  start_origin <<< "{\"/\":${HOME_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'swagger page'
  assert_output_contains 'expected 200, got 404'
  # The homepage verdict is still reported, and reported as healthy.
  assert_output_contains 'homepage'
  assert_output_contains 'returned 200 text/html with a body'
}

@test "fails when a 200 is served with a non-HTML content type" {
  # An S3 XML error document behind a misconfigured distribution looks exactly
  # like this: the status can be right while the document is not the site.
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":\"application/xml\"},\"body\":\"<Error/>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains "content-type: expected text/html, got 'application/xml'"
}

@test "fails when the page carries no content-type at all" {
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":null},\"body\":\"<div id=__next></div>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains "content-type: expected text/html, got '<missing>'"
}

@test "fails when the page body is empty" {
  start_origin <<< "{\"/\":${HOME_OK},\"/swagger\":{\"status\":200,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"\"}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'swagger page'
  assert_output_contains 'expected a non-empty page'
}

@test "fails when the origin cannot be reached at all" {
  # An unroutable port: curl never connects, so there is no status to grade and
  # the script must report that rather than treat silence as success.
  BASE_URL='http://127.0.0.1:1'
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 200, got 000'
  # curl writes its %{http_code} even on a transport failure AND exits non-zero,
  # so a naive `|| echo 000` fallback would print the code twice.
  refute_output_contains '000000'
}

@test "reports every gap in the same response, not just the first" {
  start_origin <<< "{\"/\":{\"status\":503,\"headers\":{\"content-type\":null},\"body\":\"\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'expected 200, got 503'
  assert_output_contains 'expected a non-empty page'
  assert_output_contains 'content-type: expected text/html'
}

@test "keeps grading the second path after the first one fails" {
  # "The homepage is down" and "everything is down" are different incidents, and
  # the second probe is what tells them apart in the issue that gets filed.
  start_origin <<< '{"/":{"status":500,"headers":{"content-type":"text/html"},"body":"boom"},"/swagger":{"status":502,"headers":{"content-type":"text/html"},"body":"boom"}}'
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains '::error::homepage'
  assert_output_contains '::error::swagger page'
  assert_output_contains 'expected 200, got 500'
  assert_output_contains 'expected 200, got 502'
}

@test "fails when /swagger serves the homepage document" {
  # A rewrite that points /swagger at index.html answers 200 text/html with a
  # body, so only the page's own marker tells the two documents apart.
  start_origin <<< "{\"/\":${HOME_OK},\"/swagger\":${HOME_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains '::error::swagger page'
  assert_output_contains 'body: expected a match for /swagger/i'
  refute_output_contains '::error::homepage'
}

@test "fails when the homepage body is not a Next.js document" {
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"<p>parked domain</p>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'body: expected a match for /__next|<title/i'
}

@test "reports an empty body once, not as a missing marker as well" {
  start_origin <<< "{\"/\":${HOME_OK},\"/swagger\":{\"status\":200,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"\"}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'expected a non-empty page'
  refute_output_contains 'expected a match for'
}

# --- Shapes a healthy CDN legitimately produces -----------------------------------

@test "matches the body markers case-insensitively" {
  start_origin <<< '{"/":{"status":200,"headers":{"content-type":"text/html"},"body":"<TITLE>VilnaCRM</TITLE>"},"/swagger":{"status":200,"headers":{"content-type":"text/html"},"body":"<h1>Swagger UI</h1>"}}'
  run_uptime
  [ "$status" -eq 0 ]
  refute_output_contains '::error::'
}

@test "accepts a spec-legal uppercase media type" {
  # RFC 9110 media types and subtypes are case-insensitive. Reading `TEXT/HTML` as
  # wrong would file an incident against a site that is up.
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":\"TEXT/HTML; charset=UTF-8\"},\"body\":\"<div id=__next></div>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 0 ]
  refute_output_contains '::error::'
}

@test "accepts a content-type repeated with the same correct value" {
  # An origin value plus one the CloudFront response-headers policy adds. Grading
  # only the first copy would be wrong in both directions, so every value is read.
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":[\"text/html; charset=utf-8\",\"text/html\"]},\"body\":\"<div id=__next></div>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 0 ]
  refute_output_contains '::error::'
}

@test "fails when a correct content-type is accompanied by a wrong one" {
  # One good value must not excuse a bad one beside it — that ambiguity is what
  # made Safari download the 404 in #235, and a page is no different.
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":[\"text/html\",\"application/octet-stream\"]},\"body\":\"<div id=__next></div>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'content-type: expected text/html'
}

@test "fails a media type that merely starts with the HTML one" {
  start_origin <<< "{\"/\":{\"status\":200,\"headers\":{\"content-type\":\"text/htmlish\"},\"body\":\"<div id=__next></div>\"},\"/swagger\":${SWAGGER_OK}}"
  run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains "got 'text/htmlish'"
}

# --- Retries ------------------------------------------------------------------------

@test "retries a single dropped answer rather than filing on the first miss" {
  start_origin <<< "{\"/\":[{\"status\":502,\"body\":\"hiccup\"},${HOME_OK}],\"/swagger\":${SWAGGER_OK}}"
  UPTIME_ATTEMPTS=3 run_uptime
  [ "$status" -eq 0 ]
  assert_output_contains 'homepage unhealthy (attempt 1/3)'
  assert_output_contains 'returned 200 text/html with a body'
  refute_output_contains '::error::'
}

@test "gives up after the configured number of attempts" {
  start_origin <<< "{\"/\":{\"status\":503,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"down\"},\"/swagger\":${SWAGGER_OK}}"
  UPTIME_ATTEMPTS=3 run_uptime
  [ "$status" -eq 1 ]
  assert_output_contains 'attempt 3/3'
  refute_output_contains 'attempt 4/3'
}
