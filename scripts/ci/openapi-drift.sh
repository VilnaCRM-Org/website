#!/usr/bin/env bash
# Advisory upstream-drift check: does the committed OpenAPI baseline still
# describe the same API contract as the newest user-service release? (issue #350)
#
# This is the nightly, ADVISORY leg. Upstream moving on is not a pull request
# author's fault, so a breaking diff must never red a PR — the caller turns this
# script's exit 1 into a tracking issue instead. The blocking leg is the
# mock-vs-contract parity gate (`make test-contract`).
#
# The base is contracts/user-service/openapi.json — the same artifact
# `make lint-contracts` drift-gates against USER_SERVICE_VERSION and the same one
# Mockoon.Dockerfile serves. There is deliberately no second baseline file: a
# copy would be a drift source with nothing watching it. Comparing the committed
# (normalized, Prettier-formatted) JSON against raw upstream YAML is sound —
# `scripts/fetchSwaggerSchema.mjs` only strips the invalid `maxLength: null` /
# `format: null` keywords, which oasdiff does not diff on.
#
# Exit codes are deliberately three-way; a caller that treats "any non-zero" as
# drift would report a network outage as a breaking API change:
#   0 — no breaking change between the baseline and the upstream release
#   1 — breaking changes found (report written to $OPENAPI_DRIFT_REPORT)
#   2 — the check could not run (no network, bad tag, unreadable spec, tool misuse)
#
# CALL THIS SCRIPT DIRECTLY when you need those codes. GNU Make exits 2 on any
# recipe failure and discards the recipe's own status, so the equivalent
# `make lint-openapi` target cannot tell 1 from 2 — that target is the
# human-facing surface, and .github/workflows/openapi-drift.yml invokes this
# script instead so it can route drift and breakage differently.
set -euo pipefail

OASDIFF_BIN="${OASDIFF_BIN:-./bin/oasdiff}"
OPENAPI_BASELINE="${OPENAPI_BASELINE:-contracts/user-service/openapi.json}"
USER_SERVICE_REPO="${USER_SERVICE_REPO:-VilnaCRM-Org/user-service}"
USER_SERVICE_SPEC_PATH="${USER_SERVICE_SPEC_PATH:-.github/openapi-spec/spec.yaml}"
OPENAPI_DRIFT_REPORT="${OPENAPI_DRIFT_REPORT:-reports/openapi-drift.md}"

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

# Idempotent: a no-op once the pinned, digest-verified binary is in ./bin. Kept
# inside this script so `make lint-openapi` and the nightly workflow provision it
# through exactly one path.
OASDIFF_BIN="$OASDIFF_BIN" sh "$(dirname "$0")/ensure-oasdiff.sh" ||
  fail 'could not provision the pinned oasdiff binary'

[ -x "$OASDIFF_BIN" ] || fail "oasdiff is not installed at $OASDIFF_BIN"
[ -r "$OPENAPI_BASELINE" ] || fail "baseline $OPENAPI_BASELINE is missing or unreadable"

# "Latest release" is resolved from the releases API, not by semver-sorting tags:
# upstream restarted its numbering, so the newest tag by semver (v2.x) is a year
# older than the newest release (v0.x). UPSTREAM_REF overrides it for testing.
upstream_ref="${UPSTREAM_REF:-}"
if [ -z "$upstream_ref" ]; then
  upstream_ref="$(api "https://api.github.com/repos/${USER_SERVICE_REPO}/releases/latest" |
    sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n 1)"
fi
[ -n "$upstream_ref" ] || fail "could not resolve the latest ${USER_SERVICE_REPO} release"

workdir="$(mktemp -d "${TMPDIR:-/tmp}/openapi-drift.XXXXXX")"
trap 'rm -rf "$workdir"' EXIT INT TERM
revision="$workdir/upstream-${upstream_ref}.yaml"

spec_url="https://raw.githubusercontent.com/${USER_SERVICE_REPO}/${upstream_ref}/${USER_SERVICE_SPEC_PATH}"
curl -fsSL --retry 3 --retry-all-errors --connect-timeout 10 --max-time 60 "$spec_url" -o "$revision" ||
  fail "could not fetch $spec_url — has the spec moved in $upstream_ref?"
[ -s "$revision" ] || fail "$spec_url returned an empty document"

printf '🔎 Comparing %s against %s@%s\n' "$OPENAPI_BASELINE" "$USER_SERVICE_REPO" "$upstream_ref"

report_dir="$(dirname "$OPENAPI_DRIFT_REPORT")"
mkdir -p "$report_dir" 2>/dev/null || true
[ -w "$report_dir" ] || fail "cannot write the drift report into $report_dir/"
findings="$workdir/findings.md"

# --fail-on ERR is what makes this a check at all: without it oasdiff prints
# every breaking change and still exits 0. --allow-external-refs=false stops a
# $ref in the fetched document from driving an outbound request from the runner.
set +e
"$OASDIFF_BIN" breaking "$OPENAPI_BASELINE" "$revision" \
  --fail-on ERR \
  --allow-external-refs=false \
  --format markdown >"$findings" 2>"$workdir/stderr"
status=$?
set -e

if [ "$status" -ne 0 ] && [ "$status" -ne "$EXIT_DRIFT" ]; then
  cat "$workdir/stderr" >&2
  fail "oasdiff exited $status — it could not compare the documents (this is not a drift report)"
fi

if [ "$status" -eq 0 ]; then
  printf '✅ No breaking changes between the baseline and %s\n' "$upstream_ref"
  exit 0
fi

{
  printf '## Upstream OpenAPI drift: `%s` → `%s`\n\n' \
    "$(sed -n 's/^USER_SERVICE_VERSION=//p' .env 2>/dev/null | head -n 1)" "$upstream_ref"
  printf 'The committed baseline `%s` no longer matches the newest `%s` release.\n' \
    "$OPENAPI_BASELINE" "$USER_SERVICE_REPO"
  printf 'This is **advisory**: nothing is broken in this repository. It means the\n'
  printf 'mock, the swagger page and the Apollo mock are pinned to an older contract.\n\n'
  printf 'To adopt the new contract, bump `USER_SERVICE_VERSION` in `.env`, run\n'
  printf '`make update-contracts`, then re-run `make test-contract` and `make test-e2e`.\n\n'
  printf 'Breaking changes reported by `oasdiff breaking --fail-on ERR`:\n\n'
  cat "$findings"
} >"$OPENAPI_DRIFT_REPORT"

printf '⚠️  Breaking changes found; report written to %s\n' "$OPENAPI_DRIFT_REPORT"
exit "$EXIT_DRIFT"
