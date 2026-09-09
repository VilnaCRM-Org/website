#!/usr/bin/env bash
# Advisory upstream-drift check for the GraphQL half of the user-service
# contract: does the committed SDL snapshot still describe the same schema as the
# newest user-service release? (issue #348)
#
# This mirrors scripts/ci/openapi-drift.sh deliberately, down to the exit
# contract: the two halves of the same pin deserve the same treatment, and a
# reader who has understood one has understood both. The OpenAPI half was watched
# nightly from #350; the GraphQL half was not watched at all, so a field the
# upstream schema removed stayed invisible until the next version bump — or until
# production.
#
# The base is contracts/user-service/schema.graphql — the same artifact
# `make lint-contracts` digest-gates (#376) and the same one every client
# operation is validated against. There is deliberately no second snapshot: a
# copy would be a drift source with nothing watching it.
#
# Exit codes are deliberately three-way; a caller that treats "any non-zero" as
# drift would report a network outage as a breaking API change:
#   0 — no breaking change between the snapshot and the upstream release
#   1 — breaking changes found (report written to $GRAPHQL_DRIFT_REPORT)
#   2 — the check could not run (no network, bad tag, unreadable SDL, tool misuse)
#
# CALL THIS SCRIPT DIRECTLY when you need those codes. GNU Make exits 2 on any
# recipe failure and discards the recipe's own status, so a `make` wrapper cannot
# tell 1 from 2 — that target is the human-facing surface, and
# .github/workflows/openapi-drift.yml invokes this script instead so it can route
# drift and breakage differently.
set -euo pipefail

GRAPHQL_BASELINE="${GRAPHQL_BASELINE:-contracts/user-service/schema.graphql}"
USER_SERVICE_REPO="${USER_SERVICE_REPO:-VilnaCRM-Org/user-service}"
USER_SERVICE_SCHEMA_PATH="${USER_SERVICE_SCHEMA_PATH:-.github/graphql-spec/spec}"
GRAPHQL_DRIFT_REPORT="${GRAPHQL_DRIFT_REPORT:-reports/graphql-drift.md}"

readonly EXIT_DRIFT=1
readonly EXIT_UNAVAILABLE=2

fail() {
  printf '❌ %s\n' "$1" >&2
  exit "$EXIT_UNAVAILABLE"
}

api() {
  # A token is optional (the endpoints are public) but lifts the anonymous rate
  # limit, which a scheduled runner shares with every other job on its IP.
  if [ -n "${GH_TOKEN:-}" ]; then
    curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 60 \
      -H "Authorization: Bearer ${GH_TOKEN}" \
      -H 'Accept: application/vnd.github+json' "$1"
  else
    curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 60 \
      -H 'Accept: application/vnd.github+json' "$1"
  fi
}

compare="$(dirname "$0")/graphql-drift-compare.mjs"

[ -r "$GRAPHQL_BASELINE" ] || fail "baseline $GRAPHQL_BASELINE is missing or unreadable"
[ -r "$compare" ] || fail "the comparison helper $compare is missing"
command -v node >/dev/null 2>&1 || fail 'node is not on PATH; the comparison helper cannot run'

# "Latest release" is resolved from the releases API, not by semver-sorting tags:
# upstream restarted its numbering, so the newest tag by semver (v2.x) is a year
# older than the newest release (v0.x). UPSTREAM_REF overrides it for testing.
upstream_ref="${UPSTREAM_REF:-}"
if [ -z "$upstream_ref" ]; then
  # `|| fail` is load-bearing: without it `set -e` aborts the whole script with
  # curl's own exit code (7 on a connection failure), which both skips the
  # diagnostic below and breaks the documented three-way contract.
  releases="$(api "https://api.github.com/repos/${USER_SERVICE_REPO}/releases/latest")" ||
    fail "could not reach the ${USER_SERVICE_REPO} releases API"
  # No `head`: a pipeline whose reader exits early would SIGPIPE the writer and,
  # under `pipefail`, abort here for the same reason.
  tags="$(printf '%s' "$releases" |
    sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p')"
  upstream_ref="${tags%%$'\n'*}"
fi
[ -n "$upstream_ref" ] || fail "could not resolve the latest ${USER_SERVICE_REPO} release"

workdir="$(mktemp -d "${TMPDIR:-/tmp}/graphql-drift.XXXXXX")"
trap 'rm -rf "$workdir"' EXIT INT TERM
revision="$workdir/upstream-${upstream_ref}.graphql"

schema_url="https://raw.githubusercontent.com/${USER_SERVICE_REPO}/${upstream_ref}/${USER_SERVICE_SCHEMA_PATH}"
curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 60 "$schema_url" -o "$revision" ||
  fail "could not fetch $schema_url — has the schema moved in $upstream_ref?"
[ -s "$revision" ] || fail "$schema_url returned an empty document"

printf '🔎 Comparing %s against %s@%s\n' "$GRAPHQL_BASELINE" "$USER_SERVICE_REPO" "$upstream_ref"

report_dir="$(dirname "$GRAPHQL_DRIFT_REPORT")"
mkdir -p "$report_dir" 2>/dev/null || true
# `-d` as well as `-w`: a writable *regular file* at that path would pass a bare
# `-w` and then fail the redirection below with exit 1 — indistinguishable from
# "breaking drift found", which is the one thing this script must never confuse.
{ [ -d "$report_dir" ] && [ -w "$report_dir" ]; } ||
  fail "cannot write the drift report into $report_dir/"
findings="$workdir/findings.md"

# The helper classifies with graphql-js `findBreakingChanges`, and repeats this
# script's three-way contract: anything above 1 means it could not compare the
# documents at all.
set +e
node "$compare" "$GRAPHQL_BASELINE" "$revision" >"$findings" 2>"$workdir/stderr"
status=$?
set -e

if [ "$status" -ne 0 ] && [ "$status" -ne "$EXIT_DRIFT" ]; then
  cat "$workdir/stderr" >&2
  fail "the comparison helper exited $status — it could not compare the schemas (this is not a drift report)"
fi

if [ "$status" -eq 0 ]; then
  printf '✅ No breaking changes between the snapshot and %s\n' "$upstream_ref"
  exit 0
fi

pins="$(sed -n 's/^USER_SERVICE_VERSION=//p' .env 2>/dev/null || true)"
pinned_ref="${pins%%$'\n'*}"

# The prose is a QUOTED heredoc, not a series of single-quoted printfs: the text
# is Markdown and full of backticks, which shellcheck reads inside single quotes
# as a command substitution that will not expand (SC2016). A quoted heredoc is
# literal by definition, so the warning is answered by construction rather than
# suppressed — and the dynamic values stay in printf arguments, never inline.
{
  printf '## Upstream GraphQL drift: %s -> %s\n\n' "${pinned_ref:-unknown}" "$upstream_ref"
  printf 'The committed snapshot %s no longer matches the newest %s release.\n' \
    "$GRAPHQL_BASELINE" "$USER_SERVICE_REPO"
  cat <<'PROSE'
This is **advisory**: nothing is broken in this repository. It means the Apollo
mock and every client operation are validated against an older schema. The
blocking leg is `make lint-contracts`, which validates the gql documents under
`src/features` against the committed snapshot.

To adopt the new schema, bump `USER_SERVICE_VERSION` in `.env`, run
`make update-contracts`, then re-run `make lint-contracts` and `make test-e2e`.

Breaking changes reported by graphql-js `findBreakingChanges`:

PROSE
  cat "$findings"
} >"$GRAPHQL_DRIFT_REPORT" || fail "could not write the drift report to $GRAPHQL_DRIFT_REPORT"

printf '⚠️  Breaking changes found; report written to %s\n' "$GRAPHQL_DRIFT_REPORT"
exit "$EXIT_DRIFT"
