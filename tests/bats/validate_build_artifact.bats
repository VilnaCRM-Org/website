#!/usr/bin/env bats
#
# Coverage for scripts/ci/validate-build-artifact.sh (issue #361) -- the gate
# that inspects the production static export in ./out on every PR. It fires only
# at deploy time otherwise, so a regression here is felt in production; pin the
# happy path, every failure path, and the file-count / JS-payload boundaries.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/validate-build-artifact.sh'

# Build a minimal-but-valid static export under $1 that satisfies every shape,
# route-layout, file-count-floor and JS-payload assertion the validator makes.
# $2 overrides the number of non-JS filler files used to clear the 200-file
# floor (default 210), so the total file count is 5 + $2.
# Base files are 5 (index.html, 404.html, swagger.html, one .js, and
# .well-known/security.txt), so a caller pinning an exact total must pass
# filler = total - 5. Every base path is deliberately allow-list-compatible for
# the fail-closed edge handler (issue #383): `_next` is an allowed directory and
# css/js/html are allowed extensions, so the completeness gate the validator runs
# last stays green for a well-formed fixture.
make_valid_artifact() {
  local dir="$1"
  local filler="${2:-210}"

  mkdir -p "$dir/_next/static/chunks" "$dir/.well-known"
  printf '<!doctype html><title>Home</title>' >"$dir/index.html"
  printf '<!doctype html><title>404</title>' >"$dir/404.html"
  printf '<!doctype html><title>Swagger UI</title>' >"$dir/swagger.html"
  printf 'console.log(1);' >"$dir/_next/static/chunks/main.js"
  # The REAL committed policy, because the validator now also asserts the exported
  # copy is byte-identical to it — a synthetic fixture would not exercise that.
  cp "$PROJECT_ROOT/public/.well-known/security.txt" "$dir/.well-known/security.txt"

  local i
  for ((i = 1; i <= filler; i++)); do
    : >"$dir/_next/static/asset-$i.css"
  done
}

run_validator() {
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$1"
}

setup() {
  ARTIFACT="$BATS_TEST_TMPDIR/out"
}

@test "passes a well-formed static export" {
  make_valid_artifact "$ARTIFACT"

  run_validator "$ARTIFACT"
  [ "$status" -eq 0 ]
  assert_output_contains 'build-artifact: OK'
}

@test "fails when index.html is missing" {
  make_valid_artifact "$ARTIFACT"
  rm "$ARTIFACT/index.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'missing or empty'
  assert_output_contains 'index.html'
}

@test "fails when index.html is empty" {
  make_valid_artifact "$ARTIFACT"
  : >"$ARTIFACT/index.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'missing or empty'
}

@test "fails when _next/static is missing" {
  make_valid_artifact "$ARTIFACT"
  rm -rf "$ARTIFACT/_next"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains '_next/static'
}

@test "fails when 404.html is missing" {
  make_valid_artifact "$ARTIFACT"
  rm "$ARTIFACT/404.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains '404.html'
}

@test "fails when the flat swagger.html is missing (edge route contract)" {
  make_valid_artifact "$ARTIFACT"
  rm "$ARTIFACT/swagger.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'missing flat'
  assert_output_contains 'swagger.html'
}

@test "fails when swagger.html rendered no Swagger content" {
  make_valid_artifact "$ARTIFACT"
  printf '<!doctype html><title>Blank</title>' >"$ARTIFACT/swagger.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains "no 'swagger' content"
}

@test "fails when the layout flips to a trailing-slash swagger/index.html" {
  make_valid_artifact "$ARTIFACT"
  mkdir -p "$ARTIFACT/swagger"
  printf '<!doctype html><title>Swagger UI</title>' >"$ARTIFACT/swagger/index.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'export layout flipped'
}

@test "fails when the exported security.txt is missing (issue #383)" {
  # public/.well-known/ is a dot-directory, exactly the kind of path an export or
  # tooling change drops silently.
  make_valid_artifact "$ARTIFACT"
  rm -rf "$ARTIFACT/.well-known"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'security.txt'
  assert_output_contains 'did not survive the export'
}

@test "fails when the exported security.txt has no Contact field" {
  make_valid_artifact "$ARTIFACT"
  printf 'Expires: 2027-06-30T23:59:59Z\n' >"$ARTIFACT/.well-known/security.txt"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'no Contact field'
}

@test "fails when the exported security.txt differs from the committed source" {
  # Shape checks alone would pass a policy whose contacts were altered somewhere
  # between the repository and the bucket, publishing a disclosure channel nobody
  # reviewed.
  make_valid_artifact "$ARTIFACT"
  printf 'Contact: mailto:attacker@example.com\nExpires: 2027-06-30T23:59:59Z\nCanonical: https://vilnacrm.com/.well-known/security.txt\n' \
    >"$ARTIFACT/.well-known/security.txt"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'byte-identical'
}

@test "fails when the committed source policy is missing" {
  # Run a copy of the script from a tree with no public/.well-known/ above it, so
  # the source it compares against does not exist. Skipping the comparison there
  # would leave only the shape checks, which the altered-policy fixture above
  # passes -- so the missing source has to be a hard failure, not a no-op.
  local sandbox="$BATS_TEST_TMPDIR/scripts/ci"
  mkdir -p "$sandbox"
  cp "$PROJECT_ROOT/scripts/ci/"*.sh "$PROJECT_ROOT/scripts/ci/"*.mjs "$sandbox/"
  make_valid_artifact "$ARTIFACT"

  run bash "$sandbox/$(basename "$SCRIPT_REL")" "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'cannot be verified against its reviewed source'
}

@test "accepts a lowercase RFC 9116 field name" {
  # RFC 9116 field names are case-insensitive; the exported file is compared to
  # the source byte-for-byte, so exercise the case rule on its own.
  make_valid_artifact "$ARTIFACT"
  sed -i 's/^Contact:/contact:/' "$ARTIFACT/.well-known/security.txt"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  # Fails on the byte-comparison, NOT on "no Contact field" -- proving the field
  # matcher accepted the lowercase spelling.
  assert_output_contains 'byte-identical'
}

@test "fails when a shipped path is blocked by the fail-closed edge allow-list" {
  # The acceptance criterion's own example: an exported /secret.json would be
  # 404ed in production by scripts/cloudfront_routing.js, and that must be caught
  # here rather than at deploy time.
  make_valid_artifact "$ARTIFACT"
  printf '{}' >"$ARTIFACT/secret.json"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'blocked: /secret.json'
}

@test "fails when the export ships a browser source map" {
  make_valid_artifact "$ARTIFACT"
  printf '{"version":3}' >"$ARTIFACT/_next/static/chunks/main.js.map"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'source maps present'
}

@test "accepts nested paths under every allow-listed export directory" {
  make_valid_artifact "$ARTIFACT"
  mkdir -p "$ARTIFACT/images/swagger" "$ARTIFACT/layout/favicon" "$ARTIFACT/en/docs"
  : >"$ARTIFACT/images/swagger/lock.svg"
  : >"$ARTIFACT/layout/favicon/favicon.ico"
  : >"$ARTIFACT/layout/favicon/browserconfig.xml"
  : >"$ARTIFACT/en/docs/api.html"

  run_validator "$ARTIFACT"
  [ "$status" -eq 0 ]
  assert_output_contains 'build-artifact: OK'
}

@test "fails when the export is below the file-count floor" {
  make_valid_artifact "$ARTIFACT" 0

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'floor 200'
  assert_output_contains 'looks truncated'
}

@test "passes at exactly the file-count floor (200 files)" {
  # 195 filler + the 5 base files = exactly the 200-file floor.
  make_valid_artifact "$ARTIFACT" 195

  run_validator "$ARTIFACT"
  [ "$status" -eq 0 ]
  assert_output_contains 'build-artifact: OK'
}

@test "fails one file below the floor (199 files)" {
  make_valid_artifact "$ARTIFACT" 194

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'only 199 files'
}

@test "fails when _next/static has no .js files (no JS payload)" {
  make_valid_artifact "$ARTIFACT"
  # Remove only the .js, keeping the populated _next/static dir and the 200-file
  # floor intact, so this exercises the no-JS guard rather than the earlier
  # "missing _next/static" or file-count-floor checks.
  rm "$ARTIFACT/_next/static/chunks/main.js"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'no .js files'
  assert_output_contains 'shipped no JS payload'
}

@test "fails when static JS is one byte over budget" {
  make_valid_artifact "$ARTIFACT"
  truncate -s 3300001 "$ARTIFACT/_next/static/chunks/main.js"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'over budget'
}

@test "passes at exactly the JS budget (3300000 bytes)" {
  make_valid_artifact "$ARTIFACT"
  truncate -s 3300000 "$ARTIFACT/_next/static/chunks/main.js"

  run_validator "$ARTIFACT"
  [ "$status" -eq 0 ]
  assert_output_contains 'build-artifact: OK'
}

@test "sums JS bytes across every chunk, not per file" {
  make_valid_artifact "$ARTIFACT"
  # Each chunk is under budget; their sum (3,400,001) is over it.
  truncate -s 2000000 "$ARTIFACT/_next/static/chunks/main.js"
  truncate -s 1400001 "$ARTIFACT/_next/static/chunks/vendor.js"

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'over budget'
}
