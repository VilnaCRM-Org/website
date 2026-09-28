#!/usr/bin/env bats
#
# Coverage for scripts/ci/push-release.sh (issue #481, ADR 0011): the step that
# publishes the release commit and its tag in one atomic push, after checking
# that the commit is exactly a release and the tag names it.
#
# The remote is a local bare repository. Its "branch protection" is an `update`
# hook, never a pre-receive hook: pre-receive declines the whole push, so a plain
# `--follow-tags` push would land no tag either and the regression case below
# would pass for the wrong reason. An update hook refuses one ref at a time, which
# is what GitHub's GH006 did to run 33113478799 -- the negative control proves the
# fixture really strands a tag before the script is shown not to.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/push-release.sh'

setup() {
  export GIT_CONFIG_GLOBAL=/dev/null
  export GIT_CONFIG_NOSYSTEM=1

  REMOTE="$BATS_TEST_TMPDIR/remote.git"
  WORK="$BATS_TEST_TMPDIR/work"

  git init --quiet --bare --initial-branch=main "$REMOTE"
  git init --quiet --initial-branch=main "$WORK"
  git -C "$WORK" config user.email 'bats@example.com'
  git -C "$WORK" config user.name 'bats'

  write_version '1.6.0'
  printf '# Changelog\n' >"$WORK/CHANGELOG.md"
  printf 'site\n' >"$WORK/README.md"
  git -C "$WORK" add package.json CHANGELOG.md README.md
  git -C "$WORK" commit --quiet -m 'chore: seed'
  git -C "$WORK" remote add origin "$REMOTE"
  git -C "$WORK" push --quiet origin main

  BASE="$(git -C "$WORK" rev-parse HEAD)"
}

write_version() {
  printf '{\n  "name": "website",\n  "version": "%s"\n}\n' "$1" >"$WORK/package.json"
}

# What the changelog action leaves behind with git-push: 'false' -- a
# chore(release) commit carrying the bump, the changelog and any extra paths
# named, plus the annotated tag.
release_commit() {
  local version="$1" extra
  shift

  write_version "$version"
  printf '## %s\n' "$version" >>"$WORK/CHANGELOG.md"
  for extra in "$@"; do
    printf '{}\n' >"$WORK/$extra"
  done
  git -C "$WORK" add package.json CHANGELOG.md "$@"
  git -C "$WORK" commit --quiet -m "chore(release): v${version} [skip ci]"
  git -C "$WORK" tag -a "v${version}" -m "v${version}"
}

reject_main_updates() {
  cat >"$REMOTE/hooks/update" <<'HOOK'
#!/bin/sh
if [ "$1" = refs/heads/main ]; then
  echo 'GH006: Protected branch update failed for refs/heads/main.' >&2
  exit 1
fi
exit 0
HOOK
  chmod +x "$REMOTE/hooks/update"
}

push_release() {
  cd "$WORK" || return 1
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$@"
}

remote_main() {
  git ls-remote "$REMOTE" refs/heads/main | cut -f1
}

remote_tags() {
  git ls-remote --tags "$REMOTE"
}

assert_refused_before_push() {
  [ "$status" -eq 1 ]
  assert_output_contains "::error::push-release: $1"
  refute_output_contains 'push-release: pushing'
  [ "$(remote_main)" = "$BASE" ]
  [ -z "$(remote_tags)" ]
}

# --- Positive ------------------------------------------------------------------

@test "pushes the release commit and its tag to the branch together" {
  release_commit '1.7.0'
  head="$(git -C "$WORK" rev-parse HEAD)"

  push_release v1.7.0 main
  assert_success
  assert_output_contains 'push-release: OK (v1.7.0'
  [ "$(remote_main)" = "$head" ]
  [ "$(git ls-remote "$REMOTE" 'refs/tags/v1.7.0^{}' | cut -f1)" = "$head" ]
}

@test "accepts a release commit that bumps package.json without a changelog entry" {
  write_version '1.7.0'
  git -C "$WORK" commit --quiet -am 'chore(release): v1.7.0 [skip ci]'
  git -C "$WORK" tag -a v1.7.0 -m v1.7.0

  push_release v1.7.0 main
  assert_success
  [ "$(remote_main)" = "$(git -C "$WORK" rev-parse HEAD)" ]
}

# --- Regression: issue #481 ----------------------------------------------------------

@test "negative control: a plain --follow-tags push strands the tag when main is refused" {
  reject_main_updates
  release_commit '1.7.0'

  run git -C "$WORK" push origin main --follow-tags
  [ "$status" -ne 0 ]
  [ "$(remote_main)" = "$BASE" ]
  [ -n "$(git ls-remote "$REMOTE" refs/tags/v1.7.0)" ]
}

@test "a refused branch update leaves no tag on the remote" {
  reject_main_updates
  release_commit '1.7.0'

  push_release v1.7.0 main
  [ "$status" -eq 1 ]
  assert_output_contains '::error::push-release: the remote refused the atomic push'
  [ "$(remote_main)" = "$BASE" ]
  [ -z "$(remote_tags)" ]
}

@test "a non-fast-forward branch update leaves no tag on the remote" {
  git -C "$WORK" commit --quiet --allow-empty -m 'feat: merged while the release ran'
  git -C "$WORK" push --quiet origin main
  concurrent="$(git -C "$WORK" rev-parse HEAD)"
  git -C "$WORK" reset --quiet --hard "$BASE"
  release_commit '1.7.0'

  push_release v1.7.0 main
  [ "$status" -eq 1 ]
  assert_output_contains 'the remote refused the atomic push'
  [ "$(remote_main)" = "$concurrent" ]
  [ -z "$(remote_tags)" ]
}

# --- Release-commit scope ------------------------------------------------------------

@test "refuses a release commit that also carries the generated SBOM" {
  release_commit '1.7.0' website-sbom.cdx.json

  push_release v1.7.0 main
  assert_refused_before_push "release commit"
  assert_output_contains "also changes 'website-sbom.cdx.json'"
}

@test "refuses a release commit that does not change package.json" {
  printf '## 1.6.0\n' >>"$WORK/CHANGELOG.md"
  git -C "$WORK" commit --quiet -am 'chore(release): v1.6.0 [skip ci]'
  git -C "$WORK" tag -a v1.6.0 -m v1.6.0

  push_release v1.6.0 main
  assert_refused_before_push "release commit"
  assert_output_contains 'does not change package.json'
}

@test "refuses a release commit that changes no files" {
  git -C "$WORK" commit --quiet --allow-empty -m 'chore(release): v1.6.0 [skip ci]'
  git -C "$WORK" tag -a v1.6.0 -m v1.6.0

  push_release v1.6.0 main
  assert_refused_before_push "release commit"
  assert_output_contains 'changes no files'
}

@test "refuses a merge commit as the release commit" {
  git -C "$WORK" switch --quiet -c side
  printf 'side\n' >>"$WORK/README.md"
  git -C "$WORK" commit --quiet -am 'docs: side change'
  git -C "$WORK" switch --quiet main
  write_version '1.7.0'
  git -C "$WORK" commit --quiet -am 'chore: bump'
  git -C "$WORK" merge --quiet --no-ff side -m 'chore(release): v1.7.0 [skip ci]'
  git -C "$WORK" tag -a v1.7.0 -m v1.7.0

  push_release v1.7.0 main
  assert_refused_before_push "release commit"
  assert_output_contains 'must have exactly one parent'
}

@test "refuses a root commit as the release commit" {
  git -C "$WORK" switch --quiet --orphan fresh
  write_version '1.7.0'
  git -C "$WORK" add package.json
  git -C "$WORK" commit --quiet -m 'chore(release): v1.7.0 [skip ci]'
  git -C "$WORK" tag -a v1.7.0 -m v1.7.0

  push_release v1.7.0 main
  assert_refused_before_push "release commit"
  assert_output_contains 'must have exactly one parent'
}

# --- Tag and version -----------------------------------------------------------------

@test "refuses a tag that does not point at HEAD" {
  release_commit '1.7.0'
  git -C "$WORK" tag -d v1.7.0 >/dev/null
  git -C "$WORK" tag -a v1.7.0 -m v1.7.0 HEAD^

  push_release v1.7.0 main
  assert_refused_before_push 'tag v1.7.0 points at'
  assert_output_contains 'not at HEAD'
}

@test "refuses a tag that does not exist locally" {
  release_commit '1.7.0'

  push_release v1.7.1 main
  assert_refused_before_push 'tag v1.7.1 does not exist locally'
}

@test "refuses a branch that shares the tag's name in place of the tag" {
  write_version '1.7.0'
  git -C "$WORK" commit --quiet -am 'chore(release): v1.7.0 [skip ci]'
  git -C "$WORK" branch v1.7.0

  push_release v1.7.0 main
  assert_refused_before_push 'tag v1.7.0 does not exist locally'
}

@test "refuses a package.json version that does not match the tag" {
  release_commit '1.7.0'
  git -C "$WORK" tag -a v1.8.0 -m v1.8.0

  push_release v1.8.0 main
  assert_refused_before_push "package.json at HEAD is at '1.7.0'"
  assert_output_contains 'does not match tag v1.8.0'
}

@test "refuses a tag that is not a plain vMAJOR.MINOR.PATCH" {
  release_commit '1.7.0'

  for bad in 1.7.0 v1.7 v1.7.0.1 v01.7.0 v1.7.0-rc.1 'v1.7.0 ' V1.7.0; do
    push_release "$bad" main
    assert_refused_before_push "tag '$bad' is not a vMAJOR.MINOR.PATCH release tag"
  done
}

@test "refuses an invalid branch name" {
  release_commit '1.7.0'

  for bad in 'main..x' 'has space' 'main.lock' '-f'; do
    push_release v1.7.0 "$bad"
    assert_refused_before_push "branch '$bad' is not a valid branch name"
  done
}

# --- Usage ---------------------------------------------------------------------------

@test "exits 2 with usage when an argument is missing, empty or extra" {
  release_commit '1.7.0'

  push_release
  [ "$status" -eq 2 ]
  assert_output_contains 'usage: push-release.sh <tag> <branch>'

  push_release v1.7.0
  [ "$status" -eq 2 ]

  push_release '' main
  [ "$status" -eq 2 ]

  push_release v1.7.0 ''
  [ "$status" -eq 2 ]

  push_release v1.7.0 main extra
  [ "$status" -eq 2 ]

  [ "$(remote_main)" = "$BASE" ]
  [ -z "$(remote_tags)" ]
}
