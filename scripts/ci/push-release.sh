#!/usr/bin/env bash
# Push the release commit and its tag in ONE atomic push (issue #481, ADR 0011).
#
# `.github/workflows/autorelease.yml` used to let TriPSs/conventional-changelog-action
# finish a release with `git push origin <branch> --follow-tags`. That push is not
# atomic: the server accepts or refuses each ref on its own. On 2026-08-27 (run
# 33113478799) branch protection refused the unsigned, pull-request-less release
# commit (GH006) while the tag in the same push landed, so v1.7.0 was stranded on a
# commit that is not on main -- and the version preflight
# (check-release-version.sh) has failed every run since.
#
# The workflow now runs the action with `git-push: 'false'` -- it still commits and
# tags, locally -- and calls this script instead. `git push --atomic` makes the
# server apply every ref or none, so a refused branch update can no longer leave a
# tag behind, whether the refusal is a protection rule or a non-fast-forward
# because another merge reached the branch first. A server without atomic-push
# support makes git abort client-side and push nothing, which also fails closed.
#
# Before any network call it checks what is about to be published: the tag is a
# plain vMAJOR.MINOR.PATCH, it names HEAD, package.json at HEAD carries the tag's
# version, and the release commit has one parent and changes package.json plus, at
# most, CHANGELOG.md. The v1.7.0 commit also swept the freshly generated
# website-sbom.cdx.json in through the action's `git add .`; .gitignore now keeps
# that file out, and the scope check refuses any other stray workspace file the
# same way. If the version file or the changelog output ever changes what a
# release commit touches, the allow-list in release_files_ok() has to move with it.
#
# Usage: push-release.sh <tag> <branch>
set -euo pipefail

usage() {
  echo "usage: push-release.sh <tag> <branch>" >&2
  exit 2
}

fail() {
  echo "::error::push-release: $1"
  exit 1
}

[ "$#" -eq 2 ] || usage
tag="$1"
branch="$2"
[ -n "${tag}" ] && [ -n "${branch}" ] || usage

# Anchored, with no leading zeros -- the same shape check-release-version.sh
# accepts, and the only shape the changelog action writes.
if [[ ! "${tag}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  fail "tag '${tag}' is not a vMAJOR.MINOR.PATCH release tag"
fi

# check-ref-format alone accepts a leading dash under refs/heads/, which
# `git branch` itself refuses; a release branch never starts with one.
if [[ "${branch}" == -* ]] || ! git check-ref-format "refs/heads/${branch}"; then
  fail "branch '${branch}' is not a valid branch name"
fi

head="$(git rev-parse --verify --quiet 'HEAD^{commit}')" ||
  fail "HEAD does not resolve to a commit"

# refs/tags/ is spelled out so a branch that happens to share the tag's name can
# never stand in for the tag.
tag_commit="$(git rev-parse --verify --quiet "refs/tags/${tag}^{commit}")" ||
  fail "tag ${tag} does not exist locally"

[ "${tag_commit}" = "${head}" ] ||
  fail "tag ${tag} points at ${tag_commit}, not at HEAD ${head}; refusing to publish it"

version="$(
  git show 'HEAD:package.json' 2>/dev/null |
    node -pe 'JSON.parse(require("fs").readFileSync(0, "utf8")).version || ""' 2>/dev/null
)" || fail "could not read the version from package.json at HEAD"

[ "v${version}" = "${tag}" ] ||
  fail "package.json at HEAD is at '${version}', which does not match tag ${tag}"

# A root commit has no parent to diff against, and a merge commit's first-parent
# diff would hide whatever the other parent brings along: a release commit is
# always a single-parent commit on top of the branch.
read -r -a commit_and_parents <<<"$(git rev-list --parents -n 1 "${head}")"
[ "${#commit_and_parents[@]}" -eq 2 ] ||
  fail "release commit ${head} must have exactly one parent"

changed="$(git diff --name-only --no-renames "${head}^" "${head}")" ||
  fail "could not list the files release commit ${head} changes"

[ -n "${changed}" ] || fail "release commit ${head} changes no files"

release_files_ok() {
  local path saw_version=false
  while IFS= read -r path; do
    case "${path}" in
      package.json) saw_version=true ;;
      CHANGELOG.md) ;;
      *)
        fail "release commit ${head} also changes '${path}' (allowed: package.json, CHANGELOG.md)"
        ;;
    esac
  done <<<"${changed}"
  "${saw_version}" || fail "release commit ${head} does not change package.json"
}

release_files_ok

echo "push-release: pushing ${head} to refs/heads/${branch} and tag ${tag} atomically"

# --no-follow-tags keeps the refspec list exactly the two refs named here, whatever
# push.followTags a runner or developer config sets.
git push --atomic --no-follow-tags origin \
  "HEAD:refs/heads/${branch}" "refs/tags/${tag}:refs/tags/${tag}" ||
  fail "the remote refused the atomic push; neither refs/heads/${branch} nor ${tag} was written"

echo "push-release: OK (${tag} -> ${head} on ${branch})"
