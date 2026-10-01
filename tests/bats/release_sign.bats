#!/usr/bin/env bats
#
# Coverage for scripts/ci/sign-release-commit.sh (issues #515 and #517, ADR 0017): the
# step that re-creates the changelog action's unsigned release commit through GitHub's
# Git Database API, so GitHub signs it, before push-release.sh pushes it.
#
# `gh` is a fake Git Database API backed by a real bare repository
# (create_git_data_api_gh_stub), so blob and tree SHAs are computed by git, and the
# commit it creates is an object the script really has to fetch. The red paths assert
# the specific refusal AND that neither HEAD nor the tag moved.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/sign-release-commit.sh'

setup() {
  export GIT_CONFIG_GLOBAL=/dev/null
  export GIT_CONFIG_NOSYSTEM=1

  setup_stub_dir
  create_git_data_api_gh_stub

  REMOTE="$BATS_TEST_TMPDIR/remote.git"
  WORK="$BATS_TEST_TMPDIR/work"
  export GH_FAKE_REMOTE="$REMOTE"
  export GH_TOKEN=stub-token
  export GITHUB_REPOSITORY=VilnaCRM-Org/website

  git init --quiet --bare --initial-branch=main "$REMOTE"
  # GitHub serves a commit by its full SHA before any ref names it; a plain bare
  # repository only does once this is set.
  git -C "$REMOTE" config uploadpack.allowAnySHA1InWant true
  git init --quiet --initial-branch=main "$WORK"
  git -C "$WORK" config user.email 'bats@example.com'
  git -C "$WORK" config user.name 'bats'

  write_version '1.7.0'
  printf '# Changelog\n' >"$WORK/CHANGELOG.md"
  printf 'site\n' >"$WORK/README.md"
  git -C "$WORK" add package.json CHANGELOG.md README.md
  git -C "$WORK" commit --quiet -m 'chore: seed'
  git -C "$WORK" remote add origin "$REMOTE"
  git -C "$WORK" push --quiet origin main

  BASE="$(git -C "$WORK" rev-parse HEAD)"
}

# Protocol v2 lets a local remote serve an unadvertised SHA whatever the setting, so
# v0 is forced to reproduce an origin that will not.
refuse_unadvertised_fetch() {
  git -C "$REMOTE" config uploadpack.allowAnySHA1InWant false
  git -C "$WORK" config protocol.version 0
}

write_version() {
  printf '{\n  "name": "website",\n  "version": "%s"\n}\n' "$1" >"$WORK/package.json"
}

# What the changelog action leaves behind with git-push: 'false': the bump and the
# changelog in one unsigned chore(release) commit, and the annotated tag on it.
release_commit() {
  write_version '1.8.0'
  printf '## 1.8.0\n\n- feat: something\n' >>"$WORK/CHANGELOG.md"
  git -C "$WORK" add package.json CHANGELOG.md
  commit_and_tag
}

commit_and_tag() {
  git -C "$WORK" commit --quiet -m 'chore(release): v1.8.0 [skip ci]'
  git -C "$WORK" tag -a v1.8.0 -m v1.8.0
  UNSIGNED="$(git -C "$WORK" rev-parse HEAD)"
}

sign_release() {
  cd "$WORK" || return 1
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$@"
}

request_count() {
  find "$GH_FAKE_REQUESTS" -name "*-$1.json" | wc -l
}

assert_nothing_moved() {
  [ "$(git -C "$WORK" rev-parse HEAD)" = "$UNSIGNED" ]
  [ "$(git -C "$WORK" rev-parse 'refs/tags/v1.8.0^{commit}')" = "$UNSIGNED" ]
  refute_output_contains 'sign-release-commit: OK'
}

assert_refused() {
  [ "$status" -eq 1 ]
  assert_output_contains "::error::sign-release-commit: $1"
  assert_nothing_moved
}

assert_refused_before_api() {
  assert_refused "$1"
  [ ! -s "$COMMAND_LOG" ]
}

# --- Positive ------------------------------------------------------------------

@test "replaces the release commit with GitHub's verified copy and moves the tag onto it" {
  release_commit

  sign_release v1.8.0
  assert_success
  assert_output_contains 'GitHub created verified commit'

  signed="$(git -C "$WORK" rev-parse HEAD)"
  [ "$signed" != "$UNSIGNED" ]
  assert_output_contains "sign-release-commit: OK (v1.8.0 -> ${signed}, replacing unsigned ${UNSIGNED})"
  [ "$(git -C "$WORK" rev-parse 'HEAD^{tree}')" = "$(git -C "$WORK" rev-parse "${UNSIGNED}^{tree}")" ]
  [ "$(git -C "$WORK" rev-list --parents -n 1 HEAD)" = "$signed $BASE" ]
  git -C "$WORK" cat-file commit HEAD | grep -q '^gpgsig '
  [ "$(git -C "$WORK" symbolic-ref HEAD)" = refs/heads/main ]
  [ -z "$(git -C "$WORK" status --porcelain)" ]

  [ "$(git -C "$WORK" cat-file -t refs/tags/v1.8.0)" = tag ]
  [ "$(git -C "$WORK" rev-parse 'refs/tags/v1.8.0^{commit}')" = "$signed" ]
  [ "$(git -C "$WORK" for-each-ref --format='%(contents:subject)' refs/tags/v1.8.0)" = v1.8.0 ]

  [ "$(request_count blobs)" -eq 2 ]
  [ "$(request_count trees)" -eq 1 ]
  [ "$(request_count commits)" -eq 1 ]
  assert_log_contains 'gh api --method POST repos/VilnaCRM-Org/website/git/blobs'
  assert_log_contains 'gh api --method POST repos/VilnaCRM-Org/website/git/trees'
  assert_log_contains 'gh api --method POST repos/VilnaCRM-Org/website/git/commits'
}

@test "asks GitHub for the commit with the local message and no author, committer or signature" {
  release_commit

  sign_release v1.8.0
  assert_success

  body="$(find "$GH_FAKE_REQUESTS" -name '*-commits.json')"
  [ "$(jq -c 'keys' "$body")" = '["message","parents","tree"]' ]
  jq -j '.message' "$body" >"$BATS_TEST_TMPDIR/request-message"
  git -C "$WORK" cat-file commit "$UNSIGNED" | sed '1,/^$/d' >"$BATS_TEST_TMPDIR/local-message"
  cmp -s "$BATS_TEST_TMPDIR/request-message" "$BATS_TEST_TMPDIR/local-message"
  [ "$(jq -r '.parents | join(",")' "$body")" = "$BASE" ]

  tree_body="$(find "$GH_FAKE_REQUESTS" -name '*-trees.json')"
  [ "$(jq -r '.base_tree' "$tree_body")" = "$(git -C "$WORK" rev-parse "${BASE}^{tree}")" ]
  [ "$(jq -r '[.tree[].path] | sort | join(",")' "$tree_body")" = 'CHANGELOG.md,package.json' ]
}

@test "rebuilds the signed commit from the payload when origin will not serve its SHA" {
  refuse_unadvertised_fetch
  release_commit

  sign_release v1.8.0
  assert_success
  assert_output_contains 'rebuilding it from the signed payload'

  signed="$(git -C "$WORK" rev-parse HEAD)"
  [ "$signed" != "$UNSIGNED" ]
  git -C "$REMOTE" cat-file -e "${signed}^{commit}"
  git -C "$WORK" cat-file commit "$signed" | grep -q '^gpgsig '
  [ "$(git -C "$WORK" rev-parse 'refs/tags/v1.8.0^{commit}')" = "$signed" ]
  [ "$(git -C "$WORK" rev-parse "${signed}^{tree}")" = "$(git -C "$WORK" rev-parse "${UNSIGNED}^{tree}")" ]
}

@test "refuses a rebuilt commit that does not hash to the SHA GitHub reported" {
  refuse_unadvertised_fetch
  export GH_FAKE_TAMPER_PAYLOAD=1
  release_commit

  sign_release v1.8.0
  [ "$status" -eq 1 ]
  assert_output_contains 'the commit rebuilt from GitHub'"'"'s signed payload hashes to'
  assert_nothing_moved
}

@test "hands push-release.sh a commit and tag it publishes atomically" {
  release_commit

  sign_release v1.8.0
  assert_success
  signed="$(git -C "$WORK" rev-parse HEAD)"

  run bash "$PROJECT_ROOT/scripts/ci/push-release.sh" v1.8.0 main
  assert_success
  [ "$(git ls-remote "$REMOTE" refs/heads/main | cut -f1)" = "$signed" ]
  [ "$(git ls-remote "$REMOTE" 'refs/tags/v1.8.0^{}' | cut -f1)" = "$signed" ]
}

@test "uploads a file whose path holds spaces and non-ASCII bytes byte-exactly" {
  release_commit
  git -C "$WORK" tag -d v1.8.0 >/dev/null
  git -C "$WORK" reset --quiet --soft HEAD^
  printf 'нотатки\n' >"$WORK/release notes ü.md"
  git -C "$WORK" add 'release notes ü.md'
  commit_and_tag

  sign_release v1.8.0
  assert_success
  [ "$(git -C "$WORK" rev-parse 'HEAD^{tree}')" = "$(git -C "$WORK" rev-parse "${UNSIGNED}^{tree}")" ]
}

# --- Fail closed: what GitHub returns ---------------------------------------------

@test "refuses when GitHub stores a blob under a different SHA" {
  release_commit
  export GH_FAKE_BLOB_SHA=0123456789abcdef0123456789abcdef01234567

  sign_release v1.8.0
  assert_refused "GitHub stored 'CHANGELOG.md' as blob '0123456789abcdef0123456789abcdef01234567'"
  assert_output_contains 'refusing to build on it'
  [ "$(request_count trees)" -eq 0 ]
}

@test "refuses when GitHub builds a tree that differs from the release commit's" {
  release_commit
  export GH_FAKE_TREE_SHA=0123456789abcdef0123456789abcdef01234567

  sign_release v1.8.0
  assert_refused "GitHub built tree '0123456789abcdef0123456789abcdef01234567'"
  assert_output_contains 'refusing to sign different content'
  [ "$(request_count commits)" -eq 0 ]
}

@test "refuses a commit GitHub does not report as verified" {
  release_commit
  export GH_FAKE_VERIFIED=false

  sign_release v1.8.0
  assert_refused 'GitHub did not verify the signature of commit'
  assert_output_contains '(reason: unsigned); main requires verified signatures, so nothing was pushed'
}

@test "refuses a fetched commit that carries no signature header" {
  release_commit
  export GH_FAKE_UNSIGNED=1

  sign_release v1.8.0
  assert_refused 'the fetched commit'
  assert_output_contains 'carries no signature header'
}

@test "refuses when any Git Database API call fails" {
  release_commit

  for endpoint in blobs trees commits; do
    reset_command_log
    GH_FAKE_FAIL_ON="$endpoint" sign_release v1.8.0
    assert_refused "POST repos/VilnaCRM-Org/website/git/${endpoint} failed; nothing was pushed"
    assert_output_contains 'Server Error (HTTP 500)'
  done
}

# --- Fail closed: what the release commit contains --------------------------------

@test "refuses a release commit that deletes a file" {
  write_version '1.8.0'
  git -C "$WORK" rm --quiet README.md
  git -C "$WORK" add package.json
  commit_and_tag

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} deletes 'README.md'"
}

@test "refuses a release commit that renames a file" {
  write_version '1.8.0'
  git -C "$WORK" mv README.md README.txt
  git -C "$WORK" add package.json
  commit_and_tag

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} renames or copies 'README.md'"
}

@test "refuses a release commit that sets an executable bit" {
  release_commit
  git -C "$WORK" tag -d v1.8.0 >/dev/null
  git -C "$WORK" reset --quiet --soft HEAD^
  git -C "$WORK" update-index --chmod=+x CHANGELOG.md
  commit_and_tag

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} writes 'CHANGELOG.md' with mode 100644 -> 100755"
}

@test "refuses a release commit that adds a symlink" {
  release_commit
  git -C "$WORK" tag -d v1.8.0 >/dev/null
  git -C "$WORK" reset --quiet --soft HEAD^
  ln -s README.md "$WORK/link.md"
  git -C "$WORK" add link.md
  commit_and_tag

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} writes 'link.md' with mode 000000 -> 120000"
}

@test "refuses a release commit that changes no files" {
  git -C "$WORK" commit --quiet --allow-empty -m 'chore(release): v1.8.0 [skip ci]'
  git -C "$WORK" tag -a v1.8.0 -m v1.8.0
  UNSIGNED="$(git -C "$WORK" rev-parse HEAD)"

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} changes no files"
}

@test "refuses a merge commit as the release commit" {
  git -C "$WORK" switch --quiet -c side
  printf 'side\n' >>"$WORK/README.md"
  git -C "$WORK" commit --quiet -am 'docs: side change'
  git -C "$WORK" switch --quiet main
  write_version '1.8.0'
  git -C "$WORK" commit --quiet -am 'chore: bump'
  git -C "$WORK" merge --quiet --no-ff side -m 'chore(release): v1.8.0 [skip ci]'
  git -C "$WORK" tag -a v1.8.0 -m v1.8.0
  UNSIGNED="$(git -C "$WORK" rev-parse HEAD)"

  sign_release v1.8.0
  assert_refused_before_api "release commit ${UNSIGNED} must have exactly one parent"
}

# --- Fail closed: tag and environment ---------------------------------------------

@test "refuses a tag that does not point at HEAD" {
  release_commit
  git -C "$WORK" tag -d v1.8.0 >/dev/null
  git -C "$WORK" tag -a v1.8.0 -m v1.8.0 HEAD^

  sign_release v1.8.0
  [ "$status" -eq 1 ]
  assert_output_contains 'tag v1.8.0 points at'
  [ ! -s "$COMMAND_LOG" ]
  [ "$(git -C "$WORK" rev-parse HEAD)" = "$UNSIGNED" ]
}

@test "refuses a lightweight tag" {
  release_commit
  git -C "$WORK" tag -f v1.8.0 >/dev/null

  sign_release v1.8.0
  assert_refused_before_api 'tag v1.8.0 does not exist locally as an annotated tag'
}

@test "refuses a tag that is not a plain vMAJOR.MINOR.PATCH" {
  release_commit

  for bad in 1.8.0 v1.8 v01.8.0 v1.8.0-rc.1 'v1.8.0 '; do
    sign_release "$bad"
    assert_refused_before_api "tag '$bad' is not a vMAJOR.MINOR.PATCH release tag"
  done
}

@test "refuses to run without a token or with a malformed repository" {
  release_commit

  GH_TOKEN='' sign_release v1.8.0
  assert_refused_before_api 'GH_TOKEN is not set'

  for bad in '' website 'a/b/c' 'owner/na me'; do
    GITHUB_REPOSITORY="$bad" sign_release v1.8.0
    assert_refused_before_api "GITHUB_REPOSITORY '$bad' is not an owner/name pair"
  done
}

@test "exits 2 with usage when the tag argument is missing, empty or extra" {
  release_commit

  sign_release
  [ "$status" -eq 2 ]
  assert_output_contains 'usage: sign-release-commit.sh <tag>'

  sign_release ''
  [ "$status" -eq 2 ]

  sign_release v1.8.0 extra
  [ "$status" -eq 2 ]

  assert_nothing_moved
  [ ! -s "$COMMAND_LOG" ]
}
