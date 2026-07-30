#!/usr/bin/env bash
# Guard the automated release against version/tag collisions (issue #366).
#
# `.github/workflows/autorelease.yml` bumps the version in package.json with
# TriPSs/conventional-changelog-action, then has that action run
# `git tag -a v<next>`. If a tag already sits at the version the bump lands on,
# `git tag` aborts with exit code 128 -- but only AFTER the changelog has been
# written and committed, so the job dies half-way through a release with an
# opaque "The process '/usr/bin/git' failed with exit code 128".
#
# That is exactly how releases silently stopped: package.json stayed at 0.3.0
# while tags v0.3.1 and v0.4.0 existed on the remote (orphaned by a history
# rewrite -- neither is an ancestor of main and neither has a GitHub release),
# so every push to main recomputed 0.3.0 -> 0.4.0 and died on the tag. Eight
# consecutive runs failed and no release shipped between 2026-01-20 and the
# repair.
#
# The invariant that makes any bump safe is simple and total: package.json's
# version must be at least as high as every existing tag. Then the next
# version -- patch, minor or major -- necessarily lands above every tag.
# This runs BEFORE the changelog action so a collision fails fast, loudly, and
# with a remedy, instead of corrupting a release mid-flight.
set -euo pipefail

repo_dir="${1:-.}"
pkg="${repo_dir}/package.json"

fail() {
  echo "::error::release-version: $1"
  exit 1
}

[ -f "${pkg}" ] || fail "missing ${pkg}"

version="$(
  node -pe 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).version || ""' \
    "${pkg}" 2>/dev/null
)" || fail "could not parse ${pkg}"

# Anchored on purpose. A glob like [0-9]*.[0-9]*.[0-9]* also accepts "1.6.0-rc.1"
# and "1.2.3.4", and tag discovery below keeps only plain MAJOR.MINOR.PATCH -- so a
# malformed version would be compared against a set it can never match and sail
# through the guard. Leading zeros are rejected too: "01.2.3" is not valid semver,
# and `sort -V` would order it differently from the "1.2.3" tag it means to match.
if [ -z "${version}" ]; then
  fail "${pkg} has no \"version\" field"
fi
if [[ ! "${version}" =~ ^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  fail "${pkg} version '${version}' is not a MAJOR.MINOR.PATCH semver"
fi

# Release tags are written as `v<semver>` by the changelog action. Older tags in
# this repo also exist without the `v` prefix (0.1.0), and pre-release / non-
# version tags may exist too; normalise the prefix and keep only plain semver,
# because only those can collide with a computed release tag.
#
# `git tag --list` is captured on its own so its failure is fatal. Folding it into
# the pipeline below would let `|| true` swallow a broken or missing repository as
# "no tags yet" -- the guard would pass precisely when it can no longer see the
# tags it exists to check. Only grep's no-match exit is tolerated.
raw_tags="$(git -C "${repo_dir}" tag --list)" ||
  fail "could not list git tags in ${repo_dir}"

tags="$(
  printf '%s\n' "${raw_tags}" |
    sed 's/^v//' |
    grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' || true
)"

if [ -z "${tags}" ]; then
  echo "release-version: OK (${version}; no release tags yet)"
  exit 0
fi

highest="$(printf '%s\n' "${tags}" | sort -V | tail -n 1)"

# `sort -V` orders both operands; the version is high enough exactly when it
# sorts last (ties included, since an equal string sorts to itself).
if [ "$(printf '%s\n%s\n' "${version}" "${highest}" | sort -V | tail -n 1)" != "${version}" ]; then
  fail "$(
    cat <<MSG
package.json is at ${version} but tag v${highest} already exists, so the next release would try to re-create an existing tag and abort mid-release.
Fix: set package.json's "version" to ${highest} (the highest existing tag) so the next bump lands above every tag -- or reconcile the stray tags with the maintainers first. Do not weaken this check.
MSG
  )"
fi

echo "release-version: OK (package.json ${version} >= highest tag v${highest})"
