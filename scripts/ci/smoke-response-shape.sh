#!/usr/bin/env bash
# Post-deploy negative-path smoke test (issue #363).
#
# The deploy smoke that shipped with #324 asserts HTTP 200 on `/` and `/swagger`,
# and #377 added a blocking security-header check on a real page and a real asset.
# Every CloudFront production incident this repo has had was on the path none of
# those touch — the NEGATIVE one:
#
#   #226/PR#227 (2025-09-16)  CloudFront returned 500 instead of 404
#   #229/PR#230 (2025-09-30)  the same 500-vs-404 bug recurred two weeks later
#   #235/PR#248 (2025-10-13)  Safari DOWNLOADED 404s — no content-type header
#   #249/PR#250 (2025-10-16)  missing `body` on the synthetic 404 -> 5xx
#
# `scripts/cloudfront_routing.js` is unit-tested at 100% in the `edge` Jest layer,
# so the handler's own contract is gated at PR time. This is the other half: proof
# that the deployed distribution actually associates that handler, which nothing
# inside the repository can observe.
#
# Blocking vs advisory is deliberate and split by who can fix it:
#   * The 404 SHAPE blocks. Every assertion maps to an incident above, and the fix
#     lives in this repository.
#   * The security headers and the sandbox `noindex` WARN. Two things can put a
#     header on this response — the viewer-request function in this repository,
#     which `make lint-headers` proves emits the whole policy on the synthetic
#     404, and the CloudFront response-headers policy, which lives in the infra
#     repository — and from outside there is no way to tell which one is missing.
#     Production has never been observed on this path, so a first landing that
#     blocked would risk reddening every deploy for a cause this repo may not own,
#     which is how a job gets ignored. Promotion condition: once one green deploy
#     reports no header warnings, promote these to blocking too.
#     `noindex` is infra-only — nothing in this repository emits it.
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

# Trailing slashes would produce `//path`, which CloudFront treats as a different
# URI than the one the routing handler is written against.
base="${BASE_URL%/}"

# CodePipeline deploys asynchronously and a CloudFront function association
# propagates on its own schedule, so the probe retries rather than failing on an
# early miss — the same shape as the readiness probes in deploy.yml.
SMOKE_ATTEMPTS="${SMOKE_ATTEMPTS:-12}"
SMOKE_DELAY="${SMOKE_DELAY:-15}"

# The path must not exist, and must not be one a future route could claim. The
# timestamp keeps it distinct across runs so a cached negative response from an
# earlier deploy is never what gets graded.
SMOKE_NONEXISTENT_PATH="${SMOKE_NONEXISTENT_PATH:-/smoke-nonexistent-$(date +%s)-$$}"

# The single in-repo source of truth for the header policy, shared with
# `make lint-headers` and the deploy workflow's positive-path check.
SECURITY_HEADERS_POLICY="${SECURITY_HEADERS_POLICY:-config/security-headers.json}"

# Overridable so the bats suite can prove the missing-jq branch without having to
# strip jq off PATH — which would take curl and mktemp with it.
JQ_BIN="${JQ_BIN:-jq}"

url="${base}${SMOKE_NONEXISTENT_PATH}"
work="$(mktemp -d)"
# INT/TERM as well as EXIT: a cancelled GitHub job — or the job timeout, which is
# reachable while this sleeps between retries — signals rather than returns, and the
# bats suite runs this on a real developer machine on every `make test-bats`.
#
# The signal handlers EXIT. A trap that only cleans up returns control to the line
# after the interrupted `sleep`, and the script would then grade a $body it had just
# deleted. 128+signal is the conventional status for each.
trap 'rm -rf "$work"' EXIT
trap 'rm -rf "$work"; exit 130' INT
trap 'rm -rf "$work"; exit 143' TERM
body="$work/body.out"
head="$work/headers.out"

# EVERY value for `name`, one per line, with the CR stripped and leading spaces
# trimmed. A response can legitimately carry a header twice — an origin value plus
# one the CloudFront response-headers policy adds — and grading only the first copy
# is wrong in both directions: a correct value behind a wrong one reads as a
# failure, and a wrong value behind a correct one is invisible.
#
# `|| true`: grep exits 1 on a missing header, which under `set -e` + `pipefail`
# would abort the script instead of reporting the gap.
#
# The optional second argument is the headers file to read, defaulting to `$head`
# (the negative-path probe's own response) — the cache-control advisory below reads
# two other responses (`/` and a static asset) and reuses these same helpers rather
# than duplicating the parsing.
header_values() {
  local name="$1"
  local file="${2:-$head}"
  grep -i "^${name}:" "$file" | cut -d: -f2- | sed 's/^ *//' || true
}

# The first value, for the human-readable half of a message.
header_value() {
  local name="$1"
  local file="${2:-$head}"
  header_values "$name" "$file" | head -n 1
}

fetch() {
  local code
  # `-s` not `-f`: a 404 is the expected status here, and `--fail` would suppress
  # the body and the headers this whole script exists to grade.
  #
  # curl writes its `%{http_code}` even on a transport failure — `000` — and THEN
  # exits non-zero, so an `|| echo '000'` fallback would print the code twice and
  # the operator would read `got 000000`. Capture it and default only when empty.
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
  # Normalise the header block once, so every check below reads the same text.
  tr -d '\r' < "$head" > "$head.clean" && mv "$head.clean" "$head"

  gaps=''
  # 1. Status. The incident shape is 500, and a 200 would mean the allow-list has
  #    stopped fail-closing and the bucket is answering for an unknown path.
  [ "$status" = '404' ] || gaps="${gaps}status: expected 404, got ${status}; "
  # 2. A non-empty body. CloudFront turns a synthetic response with no `body`
  #    field into a 5xx (#249), and an empty one is the same defect one step
  #    earlier.
  [ -s "$body" ] || gaps="${gaps}body: expected a non-empty 404 page; "
  # 3. content-type. Without it Safari offers the 404 as a download (#235).
  #
  #    Case-INSENSITIVE, because RFC 9110 media types and subtypes are, and this is
  #    the blocking half of the script: reading `TEXT/HTML` as wrong would block a
  #    production deploy on a correct response.
  #
  #    Whole-value, not a prefix: `text/htmlish` is a different media type, and a
  #    prefix test would wave it through.
  #
  #    EVERY value, not any: a response carrying `text/html` AND
  #    `application/octet-stream` is exactly the ambiguity that made Safari download
  #    the 404 in the first place, so one good value must not excuse a bad one.
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

# The header list is MATERIALISED before the loop, not piped into it. A process
# substitution's exit status is no part of the `while`'s, so a missing jq, an
# unreadable policy or a truncated one would each feed the loop zero lines and
# delete the whole advisory without a word — the same fail-open, three ways.
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
  # A comma-delimited directive, matched whole and case-insensitively: the header is
  # a directive LIST, `NOINDEX` is the same directive, and `noindexing` is a
  # different one that a substring test would accept. Read across every occurrence,
  # because the directives may arrive split over repeated headers.
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

# --- Advisory: the cache-control contract in docs/cdn-cache-strategy.md -----------
#
# docs/cdn-cache-strategy.md documents two cache classes this repository cannot set
# itself (S3 object metadata and the CloudFront cache policy both live in
# `website-infrastructure`) but can still read back off the live response: class 2
# (an un-hashed document, sampled here at `/`) and class 1 (a content-addressed
# `/_next/static/**` asset, discovered from `/`'s own HTML — the filename is
# content-hashed per build, so it can never be hardcoded).
#
# Advisory (`::warning::`), never `::error::`, for the same reason as the header
# check above: two different owners could be the gap (the pipeline's S3 upload step
# or the CloudFront cache policy), production has never been observed on this path,
# and a first landing that blocked would risk reddening every deploy for a header
# this repository does not own. Promotion condition: once one green deploy reports
# no cache-control warnings, promote these to blocking too, the same rule the
# security-header advisory follows.
#
# Directive PRESENCE is graded, not an exact string match: S3 and CloudFront do not
# promise a fixed `cache-control` serialization order, unlike the CloudFront-
# function-authored security headers graded above.

# The directive tokens of a `cache-control` response, comma-split, trimmed and
# lower-cased, one per line — so `Public,max-age=0,  must-revalidate` and
# `public, must-revalidate, max-age=0` read the same.
cache_control_directives() {
  local file="$1"
  header_values 'cache-control' "$file" |
    tr ',' '\n' |
    tr '[:upper:]' '[:lower:]' |
    sed 's/^[[:space:]]*//; s/[[:space:]]*$//' |
    grep -v '^$' || true
}

# Prints the required directives (comma-separated in `$2`) that `$1`'s
# cache-control is missing, comma-separated, or nothing when every one is present.
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

  # A bounded character class, never a hardcoded filename: the asset is
  # content-hashed per build. The first match is enough — one live sample per
  # class is what the advisory grades.
  asset_path="$(grep -oE '/_next/static/[A-Za-z0-9_./-]+\.(js|css)' "$root_body" | sort -u | head -n 1 || true)"
  if [ -z "$asset_path" ]; then
    echo "::warning::found no /_next/static/**.(js|css) reference in ${base}/'s HTML; skipped the class-1 cache-control advisory"
  else
    asset_head="$work/asset-headers.out"
    # `-I`: a HEAD request, since only the headers are graded here.
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
