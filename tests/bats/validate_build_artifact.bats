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
# floor (default 210); base files are 4 (index.html, 404.html, swagger.html,
# and one .js), so the total file count is 4 + $2.
make_valid_artifact() {
  local dir="$1"
  local filler="${2:-210}"

  mkdir -p "$dir/_next/static/chunks"
  printf '<!doctype html><title>Home</title>' >"$dir/index.html"
  printf '<!doctype html><title>404</title>' >"$dir/404.html"
  printf '<!doctype html><title>Swagger UI</title>' >"$dir/swagger.html"
  printf 'console.log(1);' >"$dir/_next/static/chunks/main.js"

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

@test "fails when the export is below the file-count floor" {
  make_valid_artifact "$ARTIFACT" 0

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'floor 200'
  assert_output_contains 'looks truncated'
}

@test "passes at exactly the file-count floor (200 files)" {
  make_valid_artifact "$ARTIFACT" 196

  run_validator "$ARTIFACT"
  [ "$status" -eq 0 ]
  assert_output_contains 'build-artifact: OK'
}

@test "fails one file below the floor (199 files)" {
  make_valid_artifact "$ARTIFACT" 195

  run_validator "$ARTIFACT"
  [ "$status" -eq 1 ]
  assert_output_contains 'only 199 files'
}

@test "fails when the export ships no JS payload (empty _next/static)" {
  make_valid_artifact "$ARTIFACT"
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
