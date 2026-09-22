#!/usr/bin/env bash
# Post-deploy negative-path smoke test (issue #363): probes a URI that must not
# exist and grades the response shape, since a 500-vs-404 or a missing
# content-type here has repeatedly reached production undetected.
#
# The 404 SHAPE blocks (fixable in this repo). Security headers and the sandbox
# `noindex` WARN: this repo and the infra repo's response-headers policy can each
# put a header here, and there is no way from outside to tell which one is
# missing, so a first landing that blocked risked reddening deploys for a cause
# this repo may not own. Promote to blocking once a green deploy shows no warnings.
#
# Usage: smoke-response-shape.sh <base-url> [--expect-noindex]
set -euo pipefail

BASE_URL="${1:-}"
EXPECT_NOINDEX=0
if [ "${2:-}" = '--expect-noindex' ]; then
  EXPECT_NOINDEX=1
fi

if [ -z "$BASE_URL" ]; then
  echo "::error::usage: smoke-response-shape.sh <base-url> [--expect-noindex]"
  exit 2
fi

# Strip a trailing slash: CloudFront treats `//path` as a different URI than the
# one the routing handler is written against.
base="${BASE_URL%/}"

# Retries, not a single shot: the function association propagates on its own
# schedule after deploy (same shape as deploy.yml's readiness probes).
SMOKE_ATTEMPTS="${SMOKE_ATTEMPTS:-12}"
SMOKE_DELAY="${SMOKE_DELAY:-15}"

# Timestamped so a cached negative response from an earlier run is never what
# gets graded.
SMOKE_NONEXISTENT_PATH="${SMOKE_NONEXISTENT_PATH:-/smoke-nonexistent-$(date +%s)-$$}"

# Shared source of truth with `make lint-headers` and the positive-path check.
SECURITY_HEADERS_POLICY="${SECURITY_HEADERS_POLICY:-config/security-headers.json}"

# Overridable so bats can exercise the missing-jq branch without stripping jq off
# PATH (which would take curl and mktemp with it too).
JQ_BIN="${JQ_BIN:-jq}"

url="${base}${SMOKE_NONEXISTENT_PATH}"
work="$(mktemp -d)"
# Trap INT/TERM too, not just EXIT: a cancelled job signals during the retry sleep,
# and a handler that only cleaned up would return control to the grading code with
# $body already deleted. 128+signal is the conventional exit status for each.
trap 'rm -rf "$work"' EXIT
trap 'rm -rf "$work"; exit 130' INT
trap 'rm -rf "$work"; exit 143' TERM
body="$work/body.out"
head="$work/headers.out"

# EVERY value for `name`, one per line: a response can legitimately carry a header
# twice (origin value plus one CloudFront's policy adds), and grading only the
# first copy can hide either a good or a bad value behind the other.
# `|| true`: grep's exit 1 on a missing header would abort under `set -e pipefail`.
header_values() {
  local name="$1"
  local file="${2:-$head}"
  grep -i "^${name}:" "$file" | cut -d: -f2- | sed 's/^ *//' || true
}

header_value() {
  local name="$1"
  local file="${2:-$head}"
  header_values "$name" "$file" | head -n 1
}

fetch() {
  local code
  # `-s` not `-f`: a 404 is expected here, and `--fail` would suppress the body and
  # headers this script grades. curl still writes `%{http_code}` (`000`) on a
  # transport failure and then exits non-zero, so `|| echo '000'` would double the
  # code (`got 000000`) — capture it and default only when empty.
  code="$(curl -s -o "$body" -D "$head" -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)"
  printf '%s' "${code:-000}"
}

echo "Probing the negative path: ${url}"

status=''
gaps=''
for attempt in $(seq 1 "$SMOKE_ATTEMPTS"); do
  : > "$body"
  : > "$head"
  status="$(fetch)"
  tr -d '\r' < "$head" > "$head.clean" && mv "$head.clean" "$head"

  gaps=''
  [ "$status" = '404' ] || gaps="${gaps}status: expected 404, got ${status}; "
  [ -s "$body" ] || gaps="${gaps}body: expected a non-empty 404 page; "
  # content-type, case-insensitive (RFC 9110) and whole-value, not a prefix
  # (`text/htmlish` must not pass). Every value must match, not just one: a
  # response carrying `text/html` alongside `application/octet-stream` is the
  # exact ambiguity that made Safari download the 404 (#235).
  content_type="$(header_value 'content-type')"
  content_types="$(header_values 'content-type' | tr '[:upper:]' '[:lower:]')"
  if [ -z "$content_types" ] ||
    printf '%s\n' "$content_types" | grep -qvE '^text/html[[:space:]]*(;.*)?$'; then
    gaps="${gaps}content-type: expected text/html, got '${content_type:-<missing>}'; "
  fi

  if [ -z "$gaps" ]; then
    echo "✓ ${url} returned a well-formed 404 (status, body, content-type)"
    break
  fi

  echo "… negative path not ready (attempt ${attempt}/${SMOKE_ATTEMPTS}): ${gaps}"
  if [ "$attempt" -lt "$SMOKE_ATTEMPTS" ]; then
    sleep "$SMOKE_DELAY"
  fi
done

if [ -n "$gaps" ]; then
  echo "::error::${url} — ${gaps}"
  exit 1
fi

# --- Advisory: the CloudFront response-headers policy on the 404 response ------

# Materialised before the loop, not piped in: a process substitution's exit status
# is not the `while`'s, so a missing/unreadable/truncated policy would each feed
# the loop zero lines and drop the advisory silently.
if ! command -v "$JQ_BIN" > /dev/null 2>&1; then
  echo "::warning::${JQ_BIN} is not installed; skipped the header advisory"
elif ! policy_headers="$("$JQ_BIN" -r '.headers | keys[]' "$SECURITY_HEADERS_POLICY" 2> /dev/null)"; then
  echo "::warning::${SECURITY_HEADERS_POLICY} is unreadable or is not valid JSON; skipped the header advisory"
elif [ -z "$policy_headers" ]; then
  echo "::warning::${SECURITY_HEADERS_POLICY} declares no headers; skipped the header advisory"
else
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    if [ -z "$(header_value "$name")" ]; then
      echo "::warning::${url} is missing the ${name} header; neither the viewer-request function nor the response-headers policy put it on the synthetic 404"
    fi
  done <<< "$policy_headers"
fi

# --- Advisory: sandbox origins must not be indexable --------------------------

if [ "$EXPECT_NOINDEX" -eq 1 ]; then
  robots="$(header_value 'x-robots-tag')"
  # Comma-split, case-insensitive, whole-token match across every occurrence: the
  # header is a directive LIST, and a substring test would accept `noindexing`.
  if header_values 'x-robots-tag' |
    tr '[:upper:]' '[:lower:]' |
    tr ',' '\n' |
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
    grep -qx 'noindex'; then
    echo "✓ ${url} carries X-Robots-Tag: ${robots}"
  else
    echo "::warning::${url} is not noindexed (X-Robots-Tag: ${robots:-<missing>}); a sandbox origin must not be indexable"
  fi
fi

# --- Advisory: the cache-control contract in docs/cdn-cache-strategy.md -------
#
# docs/cdn-cache-strategy.md's two cache classes are set in `website-infrastructure`
# (S3 metadata, CloudFront cache policy), not here, so this only reads them back:
# class 2 (un-hashed document, sampled at `/`) and class 1 (content-addressed
# `/_next/static/**` asset, discovered from `/`'s HTML since the hash can't be
# hardcoded). Advisory, not blocking, same ownership-split reason as the header
# check above. Directive PRESENCE is graded, not an exact string, since S3/
# CloudFront don't promise a fixed serialization order.

# Comma-split, trimmed, lower-cased directive tokens, one per line, so
# `Public,max-age=0,  must-revalidate` and `public, must-revalidate, max-age=0`
# read the same.
cache_control_directives() {
  local file="$1"
  header_values 'cache-control' "$file" |
    tr ',' '\n' |
    tr '[:upper:]' '[:lower:]' |
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
    grep -v '^$' || true
}

# Prints the required directives (comma-separated in `$2`) missing from `$1`'s
# cache-control, or nothing when all are present.
missing_cache_control_directives() {
  local file="$1"
  local required_csv="$2"
  local -a required
  IFS=',' read -r -a required <<< "$required_csv"
  local present missing='' want
  present="$(cache_control_directives "$file")"
  for want in "${required[@]}"; do
    printf '%s\n' "$present" | grep -qFx "$want" || missing="${missing}${want}, "
  done
  printf '%s' "${missing%, }"
}

root_head="$work/root-headers.out"
root_body="$work/root-body.out"
root_status="$(curl -s -o "$root_body" -D "$root_head" -w '%{http_code}' --max-time 15 "${base}/" 2>/dev/null || true)"
root_status="${root_status:-000}"
tr -d '\r' < "$root_head" > "$root_head.clean" 2> /dev/null && mv "$root_head.clean" "$root_head"

if [ "$root_status" != '200' ]; then
  echo "::warning::${base}/ returned ${root_status} instead of 200; skipped the cache-control advisory"
else
  class2_missing="$(missing_cache_control_directives "$root_head" 'public,max-age=0,must-revalidate')"
  if [ -n "$class2_missing" ]; then
    echo "::warning::${base}/ is missing cache-control directive(s): ${class2_missing}; class 2 (un-hashed documents) expects public, max-age=0, must-revalidate — see docs/cdn-cache-strategy.md"
  else
    echo "✓ ${base}/ carries the class-2 cache-control (public, max-age=0, must-revalidate)"
  fi

  # Bounded character class, not a hardcoded filename: the asset is content-hashed
  # per build. One live sample is enough for the advisory.
  asset_path="$(grep -oE '/_next/static/[A-Za-z0-9_./-]+\.(js|css)' "$root_body" | sort -u | head -n 1 || true)"
  if [ -z "$asset_path" ]; then
    echo "::warning::found no /_next/static/**.(js|css) reference in ${base}/'s HTML; skipped the class-1 cache-control advisory"
  else
    asset_head="$work/asset-headers.out"
    # `-I`: only the headers are graded here.
    asset_status="$(curl -s -o /dev/null -D "$asset_head" -I -w '%{http_code}' --max-time 15 "${base}${asset_path}" 2>/dev/null || true)"
    asset_status="${asset_status:-000}"
    tr -d '\r' < "$asset_head" > "$asset_head.clean" 2> /dev/null && mv "$asset_head.clean" "$asset_head"
    if [ "$asset_status" != '200' ]; then
      echo "::warning::${base}${asset_path} returned ${asset_status} instead of 200; skipped the class-1 cache-control advisory"
    else
      class1_missing="$(missing_cache_control_directives "$asset_head" 'public,max-age=31536000,immutable')"
      if [ -n "$class1_missing" ]; then
        echo "::warning::${base}${asset_path} is missing cache-control directive(s): ${class1_missing}; class 1 (content-addressed assets) expects public, max-age=31536000, immutable — see docs/cdn-cache-strategy.md"
      else
        echo "✓ ${base}${asset_path} carries the class-1 cache-control (public, max-age=31536000, immutable)"
      fi
    fi
  fi
fi
