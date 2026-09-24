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
GOOD_404='{"status":404,"headers":{"content-type":"text/html; charset=utf-8"},"body":"<html><head><title>Page not found - VilnaCRM</title></head><body>404</body></html>"}'

# Well-formed in every way the shape checks look at, but not the site's document:
# an S3 error page, or a routing function published before #339 branded the 404.
UNBRANDED_404='{"status":404,"headers":{"content-type":"text/html; charset=utf-8"},"body":"<html><head><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1></body></html>"}'

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

@test "refuses an unknown flag rather than ignoring it" {
  # A mistyped --require-branded that were ignored would silently downgrade the
  # blocking brand assertion to a warning on the production deploy.
  start_origin <<< "$GOOD_404"
  run_smoke --require-brandd
  [ "$status" -eq 2 ]
  assert_output_contains "unknown argument '--require-brandd'"
}

# --- The branded body (#329) -----------------------------------------------------

@test "fails a well-formed but unbranded 404 when the brand is required" {
  start_origin <<< "$UNBRANDED_404"
  run_smoke --require-branded
  [ "$status" -eq 1 ]
  assert_output_contains "expected the branded 404 (no case-insensitive match for 'Page not found - VilnaCRM')"
  refute_output_contains 'returned a well-formed 404'
}

@test "passes the branded 404 when the brand is required" {
  start_origin <<< "$GOOD_404"
  run_smoke --require-branded
  [ "$status" -eq 0 ]
  assert_output_contains "is the branded 404 (matched 'Page not found - VilnaCRM')"
  refute_output_contains 'is not the branded 404'
}

@test "passes the real edge handler's 404 with the default marker" {
  # The parity case: the served response is the one scripts/cloudfront_routing.js
  # itself builds, so rewording its document without moving the default marker
  # (or the reverse) turns this red.
  node "$PROJECT_ROOT/tests/bats/fixtures/edge-404-shape.mjs" \
    "$PROJECT_ROOT/scripts/cloudfront_routing.js" /smoke-nonexistent-fixture \
    > "$BATS_TEST_TMPDIR/edge-404.json"
  start_origin < "$BATS_TEST_TMPDIR/edge-404.json"
  run_smoke --require-branded
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
  assert_output_contains 'is the branded 404'
}

@test "matches the marker case-insensitively" {
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html"},"body":"<title>PAGE NOT FOUND - VILNACRM</title>"}'
  run_smoke --require-branded
  [ "$status" -eq 0 ]
}

@test "does not accept the brand name alone as the branded 404" {
  # The S3 error document is the site's own index.html, which carries the brand
  # too; a bare "VilnaCRM" marker would certify it.
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html"},"body":"<title>VilnaCRM</title>"}'
  run_smoke --require-branded
  [ "$status" -eq 1 ]
  assert_output_contains 'expected the branded 404'
}

@test "only warns about an unbranded 404 when the brand is not required" {
  # The sandbox and the scheduled uptime check call the script without the flag:
  # the sandbox is a bare S3 website bucket that never serves the edge document.
  start_origin <<< "$UNBRANDED_404"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
  assert_output_contains '::warning::'
  assert_output_contains 'is not the branded 404'
}

@test "reads the marker from SMOKE_404_MARKER" {
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html"},"body":"<p>Custom brand 404</p>"}'
  SMOKE_404_MARKER='custom BRAND 404' run_smoke --require-branded
  [ "$status" -eq 0 ]
  assert_output_contains "matched 'custom BRAND 404'"

  SMOKE_404_MARKER='another brand' run_smoke --require-branded
  [ "$status" -eq 1 ]
  assert_output_contains "no case-insensitive match for 'another brand'"
}

@test "falls back to the default marker when SMOKE_404_MARKER is empty" {
  # An empty fixed-string pattern matches every body.
  start_origin <<< "$UNBRANDED_404"
  SMOKE_404_MARKER='' run_smoke --require-branded
  [ "$status" -eq 1 ]
  assert_output_contains "no case-insensitive match for 'Page not found - VilnaCRM'"
}

@test "matches the marker as a fixed string, not a pattern" {
  start_origin <<< "$GOOD_404"
  SMOKE_404_MARKER='Page not found . VilnaCRM' run_smoke --require-branded
  [ "$status" -eq 1 ]
  assert_output_contains 'expected the branded 404'
}

@test "refuses a multi-line marker" {
  # grep -F reads each line as its own pattern, and an empty one matches anything.
  start_origin <<< "$UNBRANDED_404"
  SMOKE_404_MARKER=$'nothing here\n' run_smoke --require-branded
  [ "$status" -eq 2 ]
  assert_output_contains 'SMOKE_404_MARKER must be a single line'
}

@test "retries an unbranded 404 while the new routing function propagates" {
  start_origin <<< "[${UNBRANDED_404},${GOOD_404}]"
  SMOKE_ATTEMPTS=2 run_smoke --require-branded
  [ "$status" -eq 0 ]
  assert_output_contains 'attempt 1/2'
  assert_output_contains 'is the branded 404'
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

@test "accepts a content-type repeated with the same correct value" {
  # A response can carry a header twice — an origin value plus one the response-
  # headers policy adds. Grading only the FIRST copy would be wrong in both
  # directions, so every value is read.
  start_origin <<< '{"status":404,"headers":{"content-type":["text/html; charset=utf-8","text/html"]},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned a well-formed 404'
}

@test "fails when a correct content-type is accompanied by a wrong one" {
  # `text/html` AND `application/octet-stream` on the same response is precisely the
  # ambiguity that made Safari download the 404 (#235), so one good value must not
  # excuse a bad one.
  start_origin <<< '{"status":404,"headers":{"content-type":["text/html; charset=utf-8","application/octet-stream"]},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains 'content-type: expected text/html'
}

@test "fails a media type that merely starts with the HTML one" {
  # `text/htmlish` is a different media type; a prefix test would wave it through.
  start_origin <<< '{"status":404,"headers":{"content-type":"text/htmlish"},"body":"<html>404</html>"}'
  run_smoke
  [ "$status" -eq 1 ]
  assert_output_contains "got 'text/htmlish'"
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

@test "accepts a noindex directive spelled in upper case" {
  # The header is a directive LIST and the directives are case-insensitive.
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html","x-robots-tag":"NOINDEX, NOFOLLOW"},"body":"<html>404</html>"}'
  run_smoke --expect-noindex
  [ "$status" -eq 0 ]
  refute_output_contains 'is not noindexed'
}

@test "does not accept a directive that merely contains noindex" {
  # `noindexing` is not `noindex`, and a substring test would call the sandbox
  # protected when it is indexable.
  start_origin <<< '{"status":404,"headers":{"content-type":"text/html","x-robots-tag":"noindexing"},"body":"<html>404</html>"}'
  run_smoke --expect-noindex
  [ "$status" -eq 0 ]
  assert_output_contains 'is not noindexed'
}

@test "does not ask a production origin for noindex" {
  # Production must stay indexable, so the check is opt-in per call site rather
  # than something the script decides for itself.
  start_origin <<< "$GOOD_404"
  run_smoke
  [ "$status" -eq 0 ]
  refute_output_contains 'noindex'
}

# --- Advisory: the cache-control contract in docs/cdn-cache-strategy.md -----------

# A class-2 document (`/`): correct cache-control, and a body carrying a
# content-hashed class-1 asset reference for the probe to discover.
CACHE_GOOD_DOC='{"status":200,"headers":{"content-type":"text/html","cache-control":"public, max-age=0, must-revalidate"},"body":"<html><head></head><body><script src=\"/_next/static/chunks/app.abc123.js\"></script></body></html>"}'

# The class-1 asset the body above points at, with correct cache-control.
CACHE_GOOD_ASSET='{"status":200,"headers":{"content-type":"application/javascript","cache-control":"public, max-age=31536000, immutable"},"body":"console.log(1)"}'

@test "stays quiet when both live cache classes match the documented contract" {
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${CACHE_GOOD_DOC},\"/_next/static/chunks/app.abc123.js\":${CACHE_GOOD_ASSET}}}"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'carries the class-2 cache-control'
  assert_output_contains 'carries the class-1 cache-control'
  refute_output_contains 'cache-control directive(s)'
}

@test "warns, but does not fail, when an immutable asset is missing immutable" {
  local asset='{"status":200,"headers":{"content-type":"application/javascript","cache-control":"public, max-age=31536000"},"body":"console.log(1)"}'
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${CACHE_GOOD_DOC},\"/_next/static/chunks/app.abc123.js\":${asset}}}"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains '::warning::'
  assert_output_contains 'missing cache-control directive(s): immutable'
  assert_output_contains 'class 1 (content-addressed assets)'
}

@test "warns, but does not fail, when a document is missing must-revalidate and carries a long max-age" {
  local doc='{"status":200,"headers":{"content-type":"text/html","cache-control":"public, max-age=3600"},"body":"<html><script src=\"/_next/static/chunks/app.abc123.js\"></script></html>"}'
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${doc},\"/_next/static/chunks/app.abc123.js\":${CACHE_GOOD_ASSET}}}"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains '::warning::'
  assert_output_contains 'missing cache-control directive(s): max-age=0, must-revalidate'
  assert_output_contains 'class 2 (un-hashed documents)'
}

@test "warns and does not crash when the homepage body carries no static-asset reference" {
  local doc='{"status":200,"headers":{"content-type":"text/html","cache-control":"public, max-age=0, must-revalidate"},"body":"<html><body>no assets here</body></html>"}'
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${doc}}}"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'found no /_next/static'
  assert_output_contains 'skipped the class-1 cache-control advisory'
}

@test "warns rather than grading a homepage the origin fails to serve" {
  # A `/` fetch that itself 500s must not be read as an empty, passing advisory.
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":{\"status\":500,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"boom\"}}}"
  run_smoke
  [ "$status" -eq 0 ]
  assert_output_contains 'returned 500 instead of 200'
  assert_output_contains 'skipped the cache-control advisory'
}

# --- make smoke-prod (#329) ------------------------------------------------------
#
# The target is the whole post-deploy smoke: this script under --require-branded,
# then the homepage and /swagger through scripts/ci/uptime-check.sh. Each case
# breaks exactly one of the three and asserts the target goes red on it.

HOME_OK='{"status":200,"headers":{"content-type":"text/html"},"body":"<div id=\"__next\"></div>"}'
SWAGGER_OK='{"status":200,"headers":{"content-type":"text/html"},"body":"{\"page\":\"/swagger\"}"}'

run_smoke_prod() {
  run env -C "$PROJECT_ROOT" \
    SMOKE_PROD_ATTEMPTS=1 SMOKE_PROD_DELAY=0 \
    SMOKE_ATTEMPTS=1 SMOKE_DELAY=0 \
    SMOKE_NONEXISTENT_PATH=/smoke-nonexistent-fixture \
    make --no-print-directory smoke-prod SITE_URL="$BASE_URL"
}

@test "make smoke-prod passes when the homepage, /swagger and the branded 404 are healthy" {
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${HOME_OK},\"/swagger\":${SWAGGER_OK}}}"
  run_smoke_prod
  [ "$status" -eq 0 ]
  [ "$(printf '%s\n' "$output" | grep -c 'returned 200 text/html with a body')" -eq 2 ]
  assert_output_contains 'is the branded 404'
}

@test "make smoke-prod fails when the homepage is down, and still grades the 404" {
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":{\"status\":500,\"headers\":{\"content-type\":\"text/html\"},\"body\":\"boom\"},\"/swagger\":${SWAGGER_OK}}}"
  run_smoke_prod
  [ "$status" -ne 0 ]
  assert_output_contains '::error::homepage'
  assert_output_contains 'returned a well-formed 404'
}

@test "make smoke-prod fails when /swagger serves the homepage document" {
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${HOME_OK},\"/swagger\":${HOME_OK}}}"
  run_smoke_prod
  [ "$status" -ne 0 ]
  assert_output_contains '::error::swagger page'
  assert_output_contains 'expected a match for /swagger/i'
}

@test "make smoke-prod fails on a well-formed but unbranded 404" {
  start_origin <<< "{\"default\":${UNBRANDED_404},\"paths\":{\"/\":${HOME_OK},\"/swagger\":${SWAGGER_OK}}}"
  run_smoke_prod
  [ "$status" -ne 0 ]
  assert_output_contains 'expected the branded 404'
  refute_output_contains '::error::homepage'
  [ "$(printf '%s\n' "$output" | grep -c 'returned 200 text/html with a body')" -eq 2 ]
}

@test "make smoke-prod prints the 404 verdict before it probes the homepage" {
  start_origin <<< "{\"default\":${GOOD_404},\"paths\":{\"/\":${HOME_OK},\"/swagger\":${SWAGGER_OK}}}"
  run_smoke_prod
  [ "$status" -eq 0 ]
  local verdict_line home_line
  verdict_line="$(printf '%s\n' "$output" | grep -n 'returned a well-formed 404' | cut -d: -f1)"
  home_line="$(printf '%s\n' "$output" | grep -n 'Probing homepage' | cut -d: -f1)"
  [ -n "$verdict_line" ]
  [ -n "$home_line" ]
  [ "$verdict_line" -lt "$home_line" ]
}
