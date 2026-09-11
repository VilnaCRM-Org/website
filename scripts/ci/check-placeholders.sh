#!/usr/bin/env bash
# Placeholder-token gate (issue #327).
#
# The site shipped `G-XYZ` as its Google Analytics measurement id, a robots.txt
# whose `Sitemap:` line named `uk-deploy.vercel.app`, `https://yourserver.io/api/`
# as the API host fed into Sentry's tracePropagationTargets, and a README whose
# every link named `frontend-ssr-template` -- the repository this one was cloned
# from. Each was removed by hand (#328, #383, #327), and nothing stopped one from
# coming back: the only guard, tests/bats/env_config.bats, reads .env.production
# alone. This gate scans every source a placeholder can ship from and fails on
# the first hit, so a template value can no longer ride a merge into the export
# or into the README a reader meets first.
#
# Deliberately HERMETIC and dependency-free: `find` plus fixed-string `grep`
# over committed files -- no network, no node_modules, no Docker -- so it sits
# inside `make lint` and runs on the host in either EXEC_MODE, exactly like
# lint-security-txt does.
#
# Fail closed, three ways: a scan root that does not exist is an error rather
# than a skip, an empty scan set is an error, and a grep that could not read a
# file is an error. A gate that scans nothing and reports green is worse than no
# gate, because it certifies the very drift it was written to catch.
set -euo pipefail

# Byte-wise, ASCII case folding: every token is ASCII, and the scan must behave
# identically under any locale.
export LC_ALL=C

# The audited placeholders, matched case-insensitively as FIXED strings (never
# regexes, so a dot in a hostname is a dot). Add a token here when a new
# placeholder is audited out of the tree; never remove one because a scan turns
# red -- fix the file the hit names instead.
TOKENS=(
  'G-XYZ'
  'yourserver.io'
  'uk-deploy.vercel.app'
  'frontend-ssr-template'
)

# Where a placeholder can ship from: the bundled source, the routes, the inputs
# of the static export, the env files Next inlines at build time, and the README.
# A fixed list rather than an `.env*` glob: a developer's gitignored .env.local
# is not committed content and must not redden a local `make lint`. The specs
# under src/test are excluded because their fixtures legitimately carry
# look-alike hosts (src/test/testing-library/constants.ts names instagram.com);
# the exclusion is the exact directory, not a prefix, so `src/testing` or a
# `test` folder anywhere else would still be scanned.
DEFAULT_PATHS='src pages public .env .env.example .env.production README.md'
readonly EXCLUDED_DIR='src/test'

# Whitespace-separated scan roots, relative to the working directory. Only the
# Bats suite sets it, to point the gate at a runtime-assembled fixture tree; no
# Makefile target and no workflow sets it, and it cannot alter the token list.
read -r -a scan_roots <<<"${PLACEHOLDER_PATHS:-${DEFAULT_PATHS}}"

fail() {
  echo "::error::placeholders: $1"
  exit 1
}

files=()
for root in "${scan_roots[@]}"; do
  root="${root#./}"
  [ -e "${root}" ] || fail "scan root '${root}' does not exist -- the gate refuses to certify a tree it cannot see"
  while IFS= read -r file; do
    files+=("${file}")
  done < <(find "${root}" -path "${EXCLUDED_DIR}" -prune -o -type f -print | sort)
done

[ "${#files[@]}" -gt 0 ] || fail "the scan set (${scan_roots[*]}) holds no files -- nothing was checked"

grep_args=(-n -H -i -I -F)
for token in "${TOKENS[@]}"; do
  grep_args+=(-e "${token}")
done

# `grep` exits 0 on a hit, 1 on none, and 2 when it could not do its job (an
# unreadable file). The three are kept apart on purpose: folding 2 into "no
# hit" would let a permissions error pass the gate. `-I` skips binary assets
# (images, fonts): a configuration placeholder is text, and the only thing a
# byte-wise scan of compressed data can ever produce is a chance match that no
# edit could clear.
set +e
hits="$(grep "${grep_args[@]}" -- "${files[@]}")"
grep_status=$?
set -e

case "${grep_status}" in
  0)
    printf '%s\n' "${hits}"
    hit_count="$(printf '%s\n' "${hits}" | grep -c .)"
    fail "${hit_count} placeholder hit(s) above (tokens: ${TOKENS[*]}); replace the value, never the token list"
    ;;
  1)
    echo "placeholders: OK (${#files[@]} file(s) in scope, ${#TOKENS[@]} token(s); roots: ${scan_roots[*]})"
    ;;
  *)
    fail "grep exited ${grep_status} while scanning -- the tree could not be read in full"
    ;;
esac
