#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-release-version.sh (issue #366) -- the preflight
# that stops the release workflow before TriPSs/conventional-changelog-action
# computes a version whose tag already exists.
#
# This guard only ever fires on pushes to main, where a false negative costs a
# half-written release and a false positive blocks every release, so pin the
# happy path, every failure path, and the equal/one-below/one-above boundaries
# around the highest existing tag.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-release-version.sh'

# Build a throwaway git repo containing a package.json at version $2 and one
# annotated tag per remaining argument, so each test states its own
# version-vs-tags relationship inline.
make_repo() {
  local dir="$1"
  local version="$2"
  shift 2

  mkdir -p "$dir"
  git -C "$dir" init --quiet --initial-branch=main
  git -C "$dir" config user.email 'bats@example.com'
  git -C "$dir" config user.name 'bats'

  printf '{\n  "name": "website",\n  "version": "%s"\n}\n' "$version" >"$dir/package.json"
  git -C "$dir" add package.json
  git -C "$dir" commit --quiet -m 'chore: seed'

  local tag
  for tag in "$@"; do
    git -C "$dir" tag -a "$tag" -m "$tag"
  done
}

run_guard() {
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$1"
}

setup() {
  REPO="$BATS_TEST_TMPDIR/repo"
}

# --- Positive ------------------------------------------------------------------

@test "passes when the version matches the highest tag" {
  make_repo "$REPO" '1.6.0' v1.0.0 v1.5.1 v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'release-version: OK'
  assert_output_contains '1.6.0 >= highest tag v1.6.0'
}

@test "passes when the version is ahead of every tag" {
  make_repo "$REPO" '1.7.0' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'release-version: OK'
}

@test "compares versions numerically, not lexicographically" {
  # Plain string ordering puts "1.9.0" above "1.10.0"; semver does not.
  make_repo "$REPO" '1.10.0' v1.9.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'highest tag v1.9.0'
}

@test "ignores tags that are not plain semver" {
  make_repo "$REPO" '1.6.0' v1.6.0 v2.0.0-rc.1 nightly release-candidate

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'highest tag v1.6.0'
}

@test "accepts tags written without the v prefix" {
  make_repo "$REPO" '1.6.0' 0.1.0 v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'highest tag v1.6.0'
}

# --- Negative ------------------------------------------------------------------

@test "fails when a tag is ahead of the version" {
  make_repo "$REPO" '0.3.0' v0.3.0 v0.3.1 v0.4.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains '::error::release-version:'
  assert_output_contains 'package.json is at 0.3.0'
  assert_output_contains 'tag v0.4.0 already exists'
}

@test "reproduces the real #366 breakage: 0.3.0 against the legacy v1.x tag line" {
  # The exact state on main that failed eight consecutive release runs.
  make_repo "$REPO" '0.3.0' v0.2.13 v0.3.0 v0.3.1 v0.4.0 v1.0.0 v1.5.1 v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'tag v1.6.0 already exists'
  assert_output_contains 'set package.json'
}

@test "fails when package.json is missing" {
  mkdir -p "$REPO"
  git -C "$REPO" init --quiet --initial-branch=main

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'missing'
  assert_output_contains 'package.json'
}

@test "fails when package.json has no version field" {
  mkdir -p "$REPO"
  git -C "$REPO" init --quiet --initial-branch=main
  printf '{\n  "name": "website"\n}\n' >"$REPO/package.json"

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'no "version" field'
}

@test "fails when the version is not MAJOR.MINOR.PATCH semver" {
  make_repo "$REPO" '1.6' v1.5.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "rejects a prerelease suffix rather than comparing it against plain tags" {
  # Tag discovery keeps only plain MAJOR.MINOR.PATCH, so a prerelease version
  # would be compared against a set it can never match and sail through.
  make_repo "$REPO" '1.6.0-rc.1' v1.6.0 v1.7.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "rejects a version with a fourth component" {
  make_repo "$REPO" '1.2.3.4' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "rejects a version with non-numeric components" {
  make_repo "$REPO" '1a.2b.3c' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "rejects a build-metadata suffix" {
  make_repo "$REPO" '1.6.0+build.5' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "rejects zero-padded components" {
  # "01.2.3" is not valid semver, and `sort -V` orders it differently from the
  # "1.2.3" tag it is meant to match.
  make_repo "$REPO" '01.2.3' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'not a MAJOR.MINOR.PATCH semver'
}

@test "still accepts legitimate zero components" {
  # The leading-zero rule must not reject 0.x.y or a plain zero component.
  make_repo "$REPO" '0.4.0' v0.4.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'release-version: OK'
}

@test "fails closed when the tags cannot be listed at all" {
  # Not a git repository: `git tag --list` errors. Treating that as "no tags"
  # would pass the guard exactly when it can no longer see what it checks.
  mkdir -p "$REPO"
  printf '{\n  "name": "website",\n  "version": "0.3.0"\n}\n' >"$REPO/package.json"

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'could not list git tags'
}

@test "fails when package.json is not valid JSON" {
  mkdir -p "$REPO"
  git -C "$REPO" init --quiet --initial-branch=main
  printf '{ not json' >"$REPO/package.json"

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'could not parse'
}

# --- Boundary ------------------------------------------------------------------

@test "passes on an untagged repository" {
  make_repo "$REPO" '0.1.0'

  run_guard "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'no release tags yet'
}

@test "passes when the version is exactly the highest tag" {
  make_repo "$REPO" '1.6.0' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
}

@test "fails when the version is one patch below the highest tag" {
  make_repo "$REPO" '1.6.0' v1.6.1

  run_guard "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'tag v1.6.1 already exists'
}

@test "passes when the version is one patch above the highest tag" {
  make_repo "$REPO" '1.6.1' v1.6.0

  run_guard "$REPO"
  [ "$status" -eq 0 ]
}

@test "defaults to the current directory when no argument is given" {
  make_repo "$REPO" '1.6.0' v1.6.0

  run env -C "$REPO" bash "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 0 ]
  assert_output_contains 'release-version: OK'
}
