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

# The whole file is read, not just its first line. nvm, `actions/setup-node` and this
# check all consume line 1, so a second version line below it is drift that no consumer
# obeys but every reader believes — exactly the disagreement this gate exists to catch.
# Anything past the one version line is rejected rather than discarded. (Trailing blank
# lines are not content: `$(cat …)` has already dropped them.)
nvmrc_contents="$(cat .nvmrc)"

nvmrc_extra_lines="$(printf '%s\n' "$nvmrc_contents" | sed -n '2,$p' | grep -c '[^[:space:]]' || true)"
[ "$nvmrc_extra_lines" -eq 0 ] ||
  abort ".nvmrc must hold nothing but one version line; found ${nvmrc_extra_lines} further non-empty line(s), which every consumer silently ignores"

# Only surrounding whitespace is trimmed, never whitespace *inside* the value: a
# `.nvmrc` reading "24. 18.0" is malformed and must fail the format check below
# rather than be silently repaired into something that passes.
nvmrc_version="$(printf '%s\n' "$nvmrc_contents" | head -n 1 | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"

echo "$nvmrc_version" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+$' ||
  abort ".nvmrc must pin an exact MAJOR.MINOR.PATCH version, found '${nvmrc_version}'"

# --- 2. Docker base images ------------------------------------------------------
# Matches `FROM <registry>/node:<version>-<variant>` and the bare `FROM node:…`,
# with any number of leading flags (`FROM --platform=$BUILDPLATFORM node:…`), and
# case-insensitively because `from` is legal Dockerfile syntax. It does NOT match an
# unrelated image whose name merely ends in "node": the optional registry group has
# to end in `/`, so `mynode:` cannot satisfy the literal `node:` that follows it.
docker_image_pattern='^[[:space:]]*FROM[[:space:]]+(--[^[:space:]]+[[:space:]]+)*([^[:space:]]*/)?node:'
dockerfiles_checked=0
node_bases_checked=0

while IFS= read -r dockerfile; do
  dockerfiles_checked=$((dockerfiles_checked + 1))

  while IFS= read -r from_line; do
    [ -n "$from_line" ] || continue
    node_bases_checked=$((node_bases_checked + 1))

    # The tag ends at the first variant separator, digest, or whitespace, so all of
    # `node:24.18.0-alpine3.23 AS base`, `node:24.18.0 AS base` and
    # `node:24.18.0@sha256:…` reduce to the same version.
    tag="${from_line#*node:}"
    image_version="$(printf '%s' "$tag" | sed 's/[-@[:space:]].*$//')"

    if [ "$image_version" != "$nvmrc_version" ]; then
      fail "${dockerfile} pins node:${image_version}, .nvmrc pins ${nvmrc_version}"
    fi
  done <<EOF
$(grep -iE "$docker_image_pattern" "$dockerfile" || true)
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
# Each `actions/setup-node` step is validated as its own YAML block, not by comparing
# whole-file counts of two greps. Counting is fail-open in both directions: a quoted
# `uses: "actions/setup-node@…"` is not counted as a step, and a commented-out
# `# node-version-file: '.nvmrc'` counts as an input — so a step pinning a literal
# version could balance the totals and pass.
#
# The scanner below drops comments, then treats a `- ` list item as opening a step,
# closing it at the next line that is not more indented — the next `- ` of the same
# sequence, or the job key the sequence ends at (deeper `- ` items are nested sequences
# inside the step, not new steps). A step that uses setup-node must carry its own
# `node-version-file` whose value, quoted or bare, is exactly `.nvmrc`.
#
# Both keys are matched as real YAML mapping keys of that step, never as loose text:
#
#   * `uses:` must open the line (after an optional sequence dash), so a shell command
#     printing `uses: actions/setup-node@…` inside a `run: |` block cannot conjure a step
#     that nothing runs — which would satisfy the "at least one setup-node step" vacuity
#     guard while the repository has none;
#   * `node-version-file:` counts only inside the step's own `with:` mapping — a `with:`
#     sitting at the step's own key column, never one nested deeper — so neither the same
#     key under `env:` (where setup-node never reads it) nor a `with:` buried inside
#     another mapping excuses a step. The single-line flow form,
#     `with: { node-version-file: '.nvmrc' }`, is the same mapping written differently
#     and is credited too.
#
# Block scalars are therefore tracked explicitly: everything indented under a `key: |`
# or `key: >` is literal text and is skipped, structure and comment syntax alike.
scan_setup_node_steps() {
  awk '
    function close_step() {
      if (in_step && has_setup) {
        steps++
        if (!has_nvmrc) bad++
      }
      in_step = 0; has_setup = 0; has_nvmrc = 0
      in_with = 0; in_block = 0
    }
    {
      raw = $0

      # Everything indented under a `key: |` / `key: >` header is literal scalar text,
      # not YAML structure, so it is skipped wholesale — a shell script that prints
      # `- uses: actions/setup-node@…` cannot conjure a step nothing runs.
      if (in_block) {
        if (raw ~ /^[[:space:]]*$/) next
        if (match(raw, /[^[:space:]]/) - 1 > block_indent) next
        in_block = 0
      }

      line = raw
      sub(/[[:space:]]+#.*$/, "", line)
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*$/) next

      first = match(line, /[^[:space:]]/)
      indent = first - 1

      # A step ends at the next `- ` item at its own indent, and at any line that dedents
      # out of the sequence entirely (the next job key, say) — without the second rule a
      # step would absorb whatever follows its list and be credited with those keys.
      # Deeper `- ` items are nested sequences inside the step, not new steps.
      if (in_step && indent <= step_indent) close_step()
      if (!in_step && substr(line, first, 2) == "- ") {
        in_step = 1
        step_indent = indent
        step_key_indent = -1
      }

      # The mapping key on this line, with any sequence dash removed, and the column it
      # really starts at: in `- uses: x` the key is nested one level below the dash, and
      # that nesting is what separates a `with:` input from a sibling `env:` entry.
      key = substr(line, first)
      key_indent = indent
      if (substr(line, first, 2) == "- ") {
        off = match(substr(line, first + 1), /[^[:space:]]/)
        key = substr(line, first + off)
        key_indent = first + off - 1
      }

      # The column of the first mapping key of the step (the one the dash introduces) is
      # the column every direct key of that step sits at — which is how the own `with:` of
      # a step is told apart from a `with:` nested inside some other mapping of it.
      if (in_step && step_key_indent < 0) step_key_indent = key_indent

      if (in_with && key_indent <= with_indent) in_with = 0

      if (in_step) {
        if (key ~ /^uses:[[:space:]]*["'\'']?actions\/setup-node@/) has_setup = 1

        if (key_indent == step_key_indent && key ~ /^with:[[:space:]]*$/) {
          in_with = 1
          with_indent = key_indent
        } else if (key_indent == step_key_indent &&
                   key ~ /^with:[[:space:]]*\{[^}]*node-version-file:[[:space:]]*["'\'']?\.nvmrc["'\'']?[[:space:]]*[,}]/) {
          # A flow mapping is complete on its own line, so no `with:` scope is opened.
          has_nvmrc = 1
        } else if (in_with &&
                   key ~ /^node-version-file:[[:space:]]*["'\'']?\.nvmrc["'\'']?[[:space:]]*$/) {
          has_nvmrc = 1
        }
      }

      # Tracked outside the `in_step` guard on purpose: a block scalar hanging off a job
      # key must be skipped too, or its literal text is read back as structure.
      if (key ~ /:[[:space:]]*[|>][-+0-9]*[[:space:]]*$/) {
        in_block = 1
        block_indent = key_indent
      }
    }
    END { close_step(); print steps + 0, bad + 0 }
  ' "$1"
}

workflow_dir='.github/workflows'
setup_node_steps=0

# An absent workflow directory is not "nothing to check" — it is the check losing its
# subject, which is how a gate quietly stops enforcing anything.
[ -d "$workflow_dir" ] ||
  abort "${workflow_dir} is missing; the setup-node rule would not be enforced at all"

while IFS= read -r workflow; do
  [ -n "$workflow" ] || continue

  read -r file_steps file_bad <<EOF
$(scan_setup_node_steps "$workflow")
EOF
  setup_node_steps=$((setup_node_steps + file_steps))

  if [ "$file_bad" -gt 0 ]; then
    fail "${workflow} has ${file_bad} actions/setup-node step(s) without \`node-version-file: '.nvmrc'\`"
  fi

  if grep -q 'vars\.NODE_VERSION' "$workflow"; then
    fail "${workflow} reads vars.NODE_VERSION; pin Node through .nvmrc, whose value is reviewable"
  fi
done <<EOF
$(find "$workflow_dir" -type f \( -name '*.yml' -o -name '*.yaml' \) | sort)
EOF

[ "$setup_node_steps" -gt 0 ] ||
  abort "no actions/setup-node step found in any workflow; the check would pass vacuously"

# --- Result ---------------------------------------------------------------------
if [ "$failures" -gt 0 ]; then
  echo "::error::node-version: ${failures} source(s) disagree with .nvmrc (${nvmrc_version}); update them, never loosen the pin"
  exit 1
fi

echo "node-version: OK (${nvmrc_version} across ${node_bases_checked} base image(s) in ${dockerfiles_checked} Dockerfile(s), engines.node, and ${setup_node_steps} setup-node step(s))"
