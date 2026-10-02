#!/usr/bin/env bash
# Re-create the release commit through GitHub's Git Database API so GitHub signs it
# (issues #515 and #517, ADR 0017).
#
# `main` requires verified signatures. TriPSs/conventional-changelog-action makes the
# release commit with plain `git commit` on the runner, so it is unsigned and every
# push since run 36498739881 has been refused with GH006 "Commits must have verified
# signatures". GitHub signs a commit itself when a GitHub App creates it through the
# REST API with its installation token and sends no custom author, committer or
# signature ("Signature verification for bots", docs.github.com, "About commit
# signature verification"). That needs no signing key in the repository's secrets
# and no change to the branch protection.
#
# The script runs after the changelog action has committed and tagged locally, and
# before push-release.sh. It:
#   1. uploads every file the release commit adds or modifies as a blob, and checks
#      each returned blob SHA against the local one;
#   2. builds a tree on top of the parent's tree and refuses unless its SHA equals
#      the release commit's own tree -- git object ids are content hashes, so equal
#      SHAs prove the server-side commit carries byte-identical content;
#   3. creates the commit with the local message, that tree and the same single
#      parent, with no author, committer or signature, and refuses unless GitHub
#      reports it verified;
#   4. fetches the new commit by its SHA (or, if origin will not serve an unadvertised
#      SHA, rebuilds it from the signed payload the API returned and requires the
#      same SHA), re-checks its tree, parent and gpgsig header locally, moves HEAD
#      onto it and re-creates the annotated tag there.
# push-release.sh then pushes the branch and the tag in one atomic push, unchanged.
#
# It refuses anything it would have to guess at: a deletion, a rename or copy, a
# symlink, a submodule or an executable bit cannot be expressed as "upload this
# blob", so they fail closed instead. A failure leaves at most an unreferenced
# commit object on GitHub, which nothing points at; no ref is written.
#
# Inputs: the tag as the only argument; GH_TOKEN (the release App's installation
# token) and GITHUB_REPOSITORY (owner/name) from the environment.
#
# Usage: sign-release-commit.sh <tag>
set -euo pipefail

usage() {
  echo "usage: sign-release-commit.sh <tag>" >&2
  exit 2
}

fail() {
  echo "::error::sign-release-commit: $1"
  exit 1
}

[ "$#" -eq 1 ] || usage
tag="$1"
[ -n "${tag}" ] || usage

if [[ ! "${tag}" =~ ^v(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  fail "tag '${tag}' is not a vMAJOR.MINOR.PATCH release tag"
fi

[ -n "${GH_TOKEN:-}" ] || fail "GH_TOKEN is not set; the release App's token signs the commit"

repo="${GITHUB_REPOSITORY:-}"
[[ "${repo}" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]] ||
  fail "GITHUB_REPOSITORY '${repo}' is not an owner/name pair"

head="$(git rev-parse --verify --quiet 'HEAD^{commit}')" ||
  fail "HEAD does not resolve to a commit"

[ "$(git cat-file -t "refs/tags/${tag}" 2>/dev/null)" = tag ] ||
  fail "tag ${tag} does not exist locally as an annotated tag"

tag_commit="$(git rev-parse --verify --quiet "refs/tags/${tag}^{commit}")" ||
  fail "tag ${tag} does not resolve to a commit"
[ "${tag_commit}" = "${head}" ] ||
  fail "tag ${tag} points at ${tag_commit}, not at HEAD ${head}"

read -r -a commit_and_parents <<<"$(git rev-list --parents -n 1 "${head}")"
[ "${#commit_and_parents[@]}" -eq 2 ] ||
  fail "release commit ${head} must have exactly one parent"
parent="${commit_and_parents[1]}"

local_tree="$(git rev-parse "${head}^{tree}")"
base_tree="$(git rev-parse "${parent}^{tree}")"

work="$(mktemp -d)"
trap 'rm -rf "${work}"' EXIT

api_post() {
  local endpoint="$1" body="$2" out="$3"
  gh api --method POST "repos/${repo}/${endpoint}" --input "${body}" >"${out}" ||
    fail "POST repos/${repo}/${endpoint} failed; nothing was pushed"
}

# -z keeps any path byte-exact; -M reports a rename as one R entry, so it is refused
# by name rather than surfacing as a delete plus an add.
git diff-tree -r -z -M --no-commit-id --raw "${parent}" "${head}" >"${work}/diff" ||
  fail "could not list the files release commit ${head} changes"

# Every entry is checked before the first API call, so a refused commit never
# reaches GitHub at all.
: >"${work}/entries.jsonl"
while IFS= read -r -d '' meta; do
  read -r old_mode new_mode _ new_sha status <<<"${meta#:}"
  IFS= read -r -d '' path || fail "could not parse the diff of release commit ${head}"

  case "${status}" in
    A | M) ;;
    D) fail "release commit ${head} deletes '${path}'; only added or modified files can be re-created" ;;
    R* | C*) fail "release commit ${head} renames or copies '${path}'; only added or modified files can be re-created" ;;
    *) fail "release commit ${head} changes '${path}' with status ${status}; only added or modified files can be re-created" ;;
  esac

  if [ "${new_mode}" != 100644 ] || { [ "${status}" = M ] && [ "${old_mode}" != 100644 ]; }; then
    fail "release commit ${head} writes '${path}' with mode ${old_mode} -> ${new_mode}; only regular non-executable files (100644) can be re-created"
  fi

  jq -cn --arg path "${path}" --arg sha "${new_sha}" \
    '{path: $path, mode: "100644", type: "blob", sha: $sha}' >>"${work}/entries.jsonl"
done <"${work}/diff"

[ -s "${work}/entries.jsonl" ] || fail "release commit ${head} changes no files"

while IFS=$'\t' read -r new_sha path; do
  { git cat-file blob "${new_sha}" | base64 | tr -d '\n'; } >"${work}/blob.b64" ||
    fail "could not read blob ${new_sha} of '${path}'"
  jq -n --rawfile content "${work}/blob.b64" '{content: $content, encoding: "base64"}' >"${work}/blob.json"
  api_post git/blobs "${work}/blob.json" "${work}/blob.out"

  remote_blob="$(jq -r '.sha // ""' "${work}/blob.out")"
  [ "${remote_blob}" = "${new_sha}" ] ||
    fail "GitHub stored '${path}' as blob '${remote_blob}', not ${new_sha}; refusing to build on it"
done < <(jq -r '[.sha, .path] | @tsv' "${work}/entries.jsonl")

jq -s --arg base "${base_tree}" '{base_tree: $base, tree: .}' "${work}/entries.jsonl" >"${work}/tree.json"
api_post git/trees "${work}/tree.json" "${work}/tree.out"

remote_tree="$(jq -r '.sha // ""' "${work}/tree.out")"
[ "${remote_tree}" = "${local_tree}" ] ||
  fail "GitHub built tree '${remote_tree}' but release commit ${head} has tree ${local_tree}; refusing to sign different content"

# The message is copied byte for byte from the commit object. No author, committer
# or signature is sent: any of them makes GitHub skip signing the commit.
git cat-file commit "${head}" | sed '1,/^$/d' >"${work}/message" ||
  fail "could not read the message of release commit ${head}"
jq -n --rawfile message "${work}/message" --arg tree "${local_tree}" --arg parent "${parent}" \
  '{message: $message, tree: $tree, parents: [$parent]}' >"${work}/commit.json"
api_post git/commits "${work}/commit.json" "${work}/commit.out"

signed="$(jq -r '.sha // ""' "${work}/commit.out")"
[[ "${signed}" =~ ^[0-9a-f]{40}$ ]] ||
  fail "GitHub returned no commit SHA for the release commit"

if ! jq -e '.verification.verified == true' "${work}/commit.out" >/dev/null; then
  reason="$(jq -r '.verification.reason // "missing"' "${work}/commit.out")"
  fail "GitHub did not verify the signature of commit ${signed} (reason: ${reason}); main requires verified signatures, so nothing was pushed"
fi

jq -e --arg tree "${local_tree}" --arg parent "${parent}" \
  '.tree.sha == $tree and ([.parents[]?.sha] == [$parent])' "${work}/commit.out" >/dev/null ||
  fail "GitHub created commit ${signed} with a different tree or parent than release commit ${head}"

echo "sign-release-commit: GitHub created verified commit ${signed} for ${tag}"

# GitHub serves a commit by its full SHA before any ref names it, so the fetch is the
# normal path. Should origin refuse an unadvertised SHA, the same object is rebuilt
# from what the API returned: `verification.payload` is the commit without its
# signature header and `verification.signature` is that header's value. Either way
# the object is only accepted if it hashes to the SHA GitHub reported.
rebuild_signed_commit() {
  jq -j '.verification.payload // ""' "${work}/commit.out" >"${work}/payload"
  jq -j '.verification.signature // ""' "${work}/commit.out" >"${work}/signature"
  [ -s "${work}/payload" ] && [ -s "${work}/signature" ] ||
    fail "origin did not serve ${signed} and GitHub returned no signed payload to rebuild it from"

  {
    sed '/^$/q' "${work}/payload" | sed '$d'
    printf '%s\n' "$(cat "${work}/signature")" | sed -e '1s/^/gpgsig /' -e '2,$s/^/ /'
    printf '\n'
    sed '1,/^$/d' "${work}/payload"
  } >"${work}/signed-object"

  rebuilt="$(git hash-object -t commit -w "${work}/signed-object")"
  [ "${rebuilt}" = "${signed}" ] ||
    fail "the commit rebuilt from GitHub's signed payload hashes to ${rebuilt}, not ${signed}"
}

if ! git fetch --quiet --no-tags origin "${signed}" 2>/dev/null; then
  echo "sign-release-commit: origin did not serve ${signed} by SHA; rebuilding it from the signed payload"
  rebuild_signed_commit
fi

[ "$(git rev-parse --verify --quiet "${signed}^{tree}")" = "${local_tree}" ] ||
  fail "the fetched commit ${signed} does not carry tree ${local_tree}"
[ "$(git rev-list --parents -n 1 "${signed}")" = "${signed} ${parent}" ] ||
  fail "the fetched commit ${signed} does not have ${parent} as its only parent"
git cat-file commit "${signed}" | sed '/^$/q' >"${work}/signed-headers"
grep -q '^gpgsig' "${work}/signed-headers" ||
  fail "the fetched commit ${signed} carries no signature header"

git cat-file tag "refs/tags/${tag}" | sed '1,/^$/d' >"${work}/tag-message"

git update-ref -m "sign-release-commit: ${tag}" HEAD "${signed}" "${head}" ||
  fail "could not move HEAD from ${head} to ${signed}"
git tag -f -a "${tag}" -F "${work}/tag-message" "${signed}" >/dev/null ||
  fail "could not re-create tag ${tag} on ${signed}"

[ "$(git rev-parse "refs/tags/${tag}^{commit}")" = "${signed}" ] ||
  fail "tag ${tag} does not point at ${signed} after re-creating it"

echo "sign-release-commit: OK (${tag} -> ${signed}, replacing unsigned ${head})"
