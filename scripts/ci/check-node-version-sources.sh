#!/usr/bin/env bash
# Fail when the repository disagrees with itself about which Node it runs (issue #335).
#
# `.nvmrc` is the single authoritative Node version. Four other surfaces have to
# agree with it, or the dev container, CI, and a contributor's shell can each run a
# different Node while every check stays green:
#
#   1. every `FROM …node:<version>-…` base image across the repo's Dockerfiles;
#   2. `package.json` `engines.node`, which is the range `checkNodeVersion.js`
#      enforces at run time — it must pin the same version, not merely admit it
#      (a bare `^24` is satisfied by 24.0.0 as happily as by the pinned patch);
#   3. every `actions/setup-node` step, which must read `.nvmrc` rather than carry
#      a version of its own;
#   4. no workflow may reintroduce a `vars.NODE_VERSION` repository variable, whose
#      value cannot be seen — or reviewed — from inside the repository.
#
# The check is deliberately dependency-free POSIX-ish bash: it runs identically on
# the host, inside the dev container, and under Bats with stubbed binaries.
#
# Usage: ./scripts/ci/check-node-version-sources.sh [<repo-root>]
# Used by: make lint-node-version (part of `make lint`, run by static-testing.yml)
set -euo pipefail

root="${1:-.}"
cd "$root"

failures=0

fail() {
  echo "::error::node-version: $1"
  failures=$((failures + 1))
}

abort() {
  echo "::error::node-version: $1"
  exit 1
}

# --- 1. The authoritative version ---------------------------------------------
[ -f .nvmrc ] || abort ".nvmrc is missing; it is the authoritative Node version"

nvmrc_version="$(tr -d '[:space:]' <.nvmrc)"

echo "$nvmrc_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' ||
  abort ".nvmrc must pin an exact MAJOR.MINOR.PATCH version, found '${nvmrc_version}'"

# --- 2. Docker base images ------------------------------------------------------
# Matches `FROM <registry>/node:<version>-<variant>` and the bare `FROM node:…`,
# but not an unrelated image whose name merely ends in "node".
docker_image_pattern='^[[:space:]]*FROM[[:space:]]\+\([^[:space:]]*\/\)\?node:'
dockerfiles_checked=0
node_bases_checked=0

while IFS= read -r dockerfile; do
  dockerfiles_checked=$((dockerfiles_checked + 1))

  while IFS= read -r from_line; do
    [ -n "$from_line" ] || continue
    node_bases_checked=$((node_bases_checked + 1))

    tag="${from_line#*node:}"
    image_version="${tag%%-*}"

    if [ "$image_version" != "$nvmrc_version" ]; then
      fail "${dockerfile} pins node:${image_version}, .nvmrc pins ${nvmrc_version}"
    fi
  done <<EOF
$(grep "$docker_image_pattern" "$dockerfile" || true)
EOF
done <<EOF
$(find . -name node_modules -prune -o -type f \( -name Dockerfile -o -name '*.Dockerfile' \) -print | sort)
EOF

[ "$node_bases_checked" -gt 0 ] ||
  abort "no 'FROM …node:<version>' base image found in any Dockerfile; the check would pass vacuously"

# --- 3. package.json engines ----------------------------------------------------
[ -f package.json ] || abort "package.json is missing"

engines_node="$(
  sed -n '/"engines"[[:space:]]*:/,/}/p' package.json |
    sed -n 's/.*"node"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' |
    head -n 1
)"

[ -n "$engines_node" ] ||
  abort "package.json has no engines.node; it is what checkNodeVersion.js enforces"

# `checkNodeVersion.js` only understands caret clauses, so the pin has to stay a
# caret — but a caret over the full .nvmrc version, so the floor is the pinned patch.
if [ "$engines_node" != "^${nvmrc_version}" ]; then
  fail "package.json engines.node is '${engines_node}', expected '^${nvmrc_version}' to match .nvmrc"
fi

# --- 4. GitHub Actions Node setup -----------------------------------------------
workflow_dir='.github/workflows'
setup_node_steps=0

if [ -d "$workflow_dir" ]; then
  while IFS= read -r workflow; do
    [ -n "$workflow" ] || continue

    uses_count="$(grep -c 'uses:[[:space:]]*actions/setup-node@' "$workflow" || true)"
    nvmrc_count="$(grep -c "node-version-file:[[:space:]]*'\.nvmrc'" "$workflow" || true)"
    setup_node_steps=$((setup_node_steps + uses_count))

    if [ "$uses_count" -ne "$nvmrc_count" ]; then
      fail "${workflow} has ${uses_count} actions/setup-node step(s) but ${nvmrc_count} \`node-version-file: '.nvmrc'\` input(s)"
    fi

    if grep -q 'vars\.NODE_VERSION' "$workflow"; then
      fail "${workflow} reads vars.NODE_VERSION; pin Node through .nvmrc, whose value is reviewable"
    fi
  done <<EOF
$(find "$workflow_dir" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)
EOF
fi

# --- Result ---------------------------------------------------------------------
if [ "$failures" -gt 0 ]; then
  echo "::error::node-version: ${failures} source(s) disagree with .nvmrc (${nvmrc_version}); update them, never loosen the pin"
  exit 1
fi

echo "node-version: OK (${nvmrc_version} across ${node_bases_checked} base image(s) in ${dockerfiles_checked} Dockerfile(s), engines.node, and ${setup_node_steps} setup-node step(s))"
