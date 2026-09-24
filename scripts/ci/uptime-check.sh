#!/usr/bin/env bash
# Synthetic uptime check — the positive path (issue #336).
#
# Until this landed, nothing in the repository would tell anyone the production
# site was down: the post-deploy smoke in deploy.yml only ever runs after a push
# to main, and it skips while the PRODUCTION_SITE_URL variable is unset. This is
# the half of the scheduled check (.github/workflows/uptime-check.yml) that
# proves the site is UP: the two documents a visitor actually lands on must both
# answer. `make smoke-prod` runs the same script after a deploy (issue #329),
# with a longer retry budget, so the two checks cannot disagree about "up".
#
# Each path is graded on four things, and every gap is reported in one line so
# the incident issue names the whole shape rather than the first miss:
#   * status 200 — a CloudFront 5xx, an S3 error document, or a redirect loop
#     each surface here;
#   * content-type text/html — an S3 XML error document is served as
#     application/xml with a 200-looking body, so the status alone can lie;
#   * a non-empty body — CloudFront can answer 200 with nothing behind it when
#     the object is missing from the bucket the distribution points at;
#   * a body marker, a case-insensitive ERE — `__next` or `<title` for the
#     homepage, `swagger` for /swagger (the page's own chunk path and
#     __NEXT_DATA__ name it, the homepage does not), so a /swagger rewritten to
#     the homepage document is caught. These are the markers the inline
#     deploy.yml probe used before #329 moved it here.
#
# The negative path — an unknown URI must produce the site's own 404 — is a
# different contract with its own incident history, and it is graded by
# scripts/ci/smoke-response-shape.sh. The workflow calls both; this script does
# not duplicate that one.
#
# Usage: uptime-check.sh <base-url>
set -euo pipefail

BASE_URL="${1:-}"

if [ -z "$BASE_URL" ]; then
  echo "::error::usage: uptime-check.sh <base-url>"
  exit 2
fi

# Trailing slashes would produce `//swagger`, which CloudFront treats as a
# different URI than the one the routing handler is written against.
base="${BASE_URL%/}"

# A synthetic check is not waiting for a deploy to propagate, so the retry budget
# is short: enough to ride out a single dropped connection, not enough to hide a
# real outage until the next scheduled run. Overridable so the bats suite can
# collapse the delay and pin the retry path, and so `make smoke-prod` can give a
# deploy that is still propagating the time it needs.
UPTIME_ATTEMPTS="${UPTIME_ATTEMPTS:-4}"
UPTIME_DELAY="${UPTIME_DELAY:-15}"

work="$(mktemp -d)"
# INT/TERM as well as EXIT, and the signal handlers EXIT: a cancelled GitHub job
# — or the job timeout, reachable while this sleeps between retries — signals
# rather than returns, and a trap that only cleaned up would hand control back to
# the line after the interrupted `sleep`, grading a $body it had just deleted.
# 128+signal is the conventional status for each.
trap 'rm -rf "$work"' EXIT
trap 'rm -rf "$work"; exit 130' INT
trap 'rm -rf "$work"; exit 143' TERM
body="$work/body.out"
head="$work/headers.out"

# EVERY value for `name`, one per line, CR stripped and leading spaces trimmed. A
# response can carry a header twice — an origin value plus one the CloudFront
# response-headers policy adds — and grading only the first copy is wrong in both
# directions.
#
# `|| true`: grep exits 1 on a missing header, which under `set -e` + `pipefail`
# would abort the script instead of reporting the gap.
header_values() {
  local name="$1"
  grep -i "^${name}:" "$head" | cut -d: -f2- | sed 's/^ *//' || true
}

header_value() {
  header_values "$1" | head -n 1
}

fetch() {
  local url="$1" code
  # `-s` not `-f`: `--fail` discards the body of a non-2xx answer before it is
  # saved, so a 500 that carried a page would be graded as a 500 with NO page —
  # a second gap the response never had, in the line an operator reads first.
  #
  # curl writes its `%{http_code}` even on a transport failure — `000` — and THEN
  # exits non-zero, so an `|| echo '000'` fallback would print the code twice and
  # the operator would read `got 000000`. Capture it and default only when empty.
  code="$(curl -s -o "$body" -D "$head" -w '%{http_code}' --max-time 15 "$url" 2>/dev/null || true)"
  printf '%s' "${code:-000}"
}

# Grade the response currently in $status / $body / $head into $gaps, with the
# path's body marker in $1.
grade() {
  local marker="$1"
  gaps=''
  [ "$status" = '200' ] || gaps="${gaps}status: expected 200, got ${status}; "
  if [ ! -s "$body" ]; then
    gaps="${gaps}body: expected a non-empty page; "
  elif ! grep -qiE -e "$marker" "$body"; then
    gaps="${gaps}body: expected a match for /${marker}/i; "
  fi
  # Case-INSENSITIVE, because RFC 9110 media types and subtypes are; whole-value,
  # because `text/htmlish` is a different media type; and EVERY value, because
  # one correct copy must not excuse a wrong one beside it.
  local content_type content_types
  content_type="$(header_value 'content-type')"
  content_types="$(header_values 'content-type' | tr '[:upper:]' '[:lower:]')"
  if [ -z "$content_types" ] ||
    printf '%s\n' "$content_types" | grep -qvE '^text/html[[:space:]]*(;.*)?$'; then
    gaps="${gaps}content-type: expected text/html, got '${content_type:-<missing>}'; "
  fi
}

probe() {
  local path="$1" label="$2" marker="$3" url attempt
  url="${base}${path}"
  echo "Probing ${label}: ${url}"
  for attempt in $(seq 1 "$UPTIME_ATTEMPTS"); do
    : > "$body"
    : > "$head"
    status="$(fetch "$url")"
    tr -d '\r' < "$head" > "$head.clean" && mv "$head.clean" "$head"
    grade "$marker"
    if [ -z "$gaps" ]; then
      echo "✓ ${label} (${url}) returned 200 text/html with a body"
      return 0
    fi
    echo "… ${label} unhealthy (attempt ${attempt}/${UPTIME_ATTEMPTS}): ${gaps}"
    if [ "$attempt" -lt "$UPTIME_ATTEMPTS" ]; then
      sleep "$UPTIME_DELAY"
    fi
  done
  echo "::error::${label} (${url}) — ${gaps}"
  return 1
}

# Both paths are always graded, even when the first is already down: an incident
# issue that says "the homepage is down" reads very differently from one that
# says "everything is down", and the second probe is what tells them apart.
rc=0
probe '/' 'homepage' '__next|<title' || rc=1
probe '/swagger' 'swagger page' 'swagger' || rc=1
exit "$rc"
