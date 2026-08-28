#!/usr/bin/env bash
# Validate the published RFC 9116 security.txt (issue #383).
#
# `Expires` is a HARD expiry: RFC 9116 section 2.5.5 tells consumers to ignore
# the policy once that timestamp is in the past, so a stale security.txt is
# worse than none -- it advertises a reporting channel scanners refuse to use,
# and nothing else in this repository would ever notice it lapse. This gate runs
# inside `make lint`, and fails while there is still runway to open, review and
# merge the refresh.
#
# The remedy for a red gate is always to BUMP `Expires` in
# public/.well-known/security.txt (and re-confirm the contacts still reach a
# human). The day thresholds below are hardcoded and deliberately NOT readable
# from the environment: lowering a gate threshold is a policy violation here.
#
# The committed file uses LF, not the CRLF of RFC 9116 section 4's ABNF. Every
# known consumer accepts LF, and CRLF would fight .editorconfig's house style
# for no interoperability gain. Do not "fix" that.
set -euo pipefail

# Byte-wise matching, so every check below behaves identically under any locale.
export LC_ALL=C

file="${1:-public/.well-known/security.txt}"

# Fail this many days BEFORE the file actually expires. Hardcoded on purpose.
readonly MIN_DAYS_REMAINING=60
# RFC 9116 section 2.5.5 recommends less than a year. This closes the obvious
# cheat: the fix for a red gate must not be `Expires: 2099-01-01`.
readonly MAX_DAYS_AHEAD=366
# The URI this policy is published at. RFC 9116 section 2.5.2 tells consumers to
# distrust a file whose `Canonical` does not name the location they fetched, so a
# foreign or typo'd host silently invalidates the whole policy while still
# reading fine. Pinned here for the same reason robots.txt pins its `Sitemap`
# origin (src/test/unit/robots-txt.test.ts); move it only with the deployed one.
readonly CANONICAL_URI='https://vilnacrm.com/.well-known/security.txt'

# Injected clock (UTC calendar date, YYYY-MM-DD). Only the Bats suite sets it,
# to pin the near-expiry boundaries without waiting a year. No Makefile target
# and no workflow sets it, and it cannot relax the thresholds above.
today="${SECURITY_TXT_TODAY:-$(date -u +%Y-%m-%d)}"

fail() {
  echo "::error::security-txt: $1"
  exit 1
}

# A YYYY-MM-DD date that a Gregorian calendar actually has. The day-delta
# arithmetic below normalises an impossible one (2027-02-31 -> 3 March) instead
# of rejecting it, so both the injected clock and `Expires` are checked here.
is_real_calendar_date() {
  awk -v d="$1" '
    BEGIN {
      split(d, p, "-")
      y = p[1] + 0; m = p[2] + 0; day = p[3] + 0
      leap = (y % 4 == 0 && y % 100 != 0) || (y % 400 == 0)
      split("31 28 31 30 31 30 31 31 30 31 30 31", len, " ")
      if (m == 2 && leap) len[2] = 29
      exit (day >= 1 && day <= len[m]) ? 0 : 1
    }'
}

# RFC 9116 section 4 writes the field names as ABNF string literals, which
# RFC 5234 section 2.3 makes case-insensitive, so `expires:` is as much an
# `Expires` field as `Expires:` is -- and a lookup that misses it reports a
# duplicate as unique. Fold the NAME only; every value pattern below stays
# byte-exact, matched after this `Field:` prefix.
field_lines() {
  grep -iE "^${1}:" "${file}" || true
}
field_prefix_re='^[A-Za-z0-9_-]+:[[:space:]]*'
field_prefix_sed='s/^[A-Za-z0-9_-]*:[[:space:]]*//p'

if ! printf '%s' "${today}" | grep -qE '^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' ||
  ! is_real_calendar_date "${today}"; then
  fail "SECURITY_TXT_TODAY='${today}' is not a YYYY-MM-DD calendar date"
fi

# --- File shape ----------------------------------------------------------------
{ [ -f "${file}" ] && [ -s "${file}" ]; } || fail "missing or empty ${file}"

# Every line must be a comment, blank, or a `Field: value` pair, so a typo'd
# field name or a stray body line cannot ship unnoticed.
line_re='^(#.*|[[:space:]]*|[A-Za-z0-9_-]+:[[:space:]]*[^[:space:]].*)$'
if bad_line="$(grep -nvE "${line_re}" "${file}")"; then
  fail "${file}: not an RFC 9116 field line: ${bad_line}"
fi

# --- Contact (REQUIRED, may repeat; the first listed is the preferred one) ------
contact_re="${field_prefix_re}(https://|mailto:|tel:)[^[:space:]]"
contacts="$(field_lines Contact | grep -cE "${contact_re}" || true)"
if [ "${contacts}" -eq 0 ]; then
  fail "${file}: no 'Contact:' field with an https://, mailto: or tel: URI (RFC 9116 section 2.5.3)"
fi

# Counting only the usable values would let a malformed sibling -- a bare email
# address, a plaintext http URI -- ship unnoticed behind a good one, so every
# Contact line has to carry a URI a reporter can actually use.
if bad_contact="$(field_lines Contact | grep -vE "${contact_re}")"; then
  fail "${file}: 'Contact:' value is not an https://, mailto: or tel: URI: ${bad_contact}"
fi

# --- Canonical must name the URI the file is actually served from --------------
# Every value, not just one of them: a second, foreign Canonical carries exactly
# the hazard CANONICAL_URI is pinned against.
canonical_count="$(field_lines Canonical | grep -c . || true)"
canonical_ok="$(field_lines Canonical | sed -n "${field_prefix_sed}" |
  grep -cxF "${CANONICAL_URI}" || true)"
if [ "${canonical_count}" -eq 0 ] || [ "${canonical_ok}" -ne "${canonical_count}" ]; then
  fail "${file}: 'Canonical:' must be an https URI naming the published policy location ${CANONICAL_URI}"
fi

# --- Expires (REQUIRED, MUST NOT repeat) ---------------------------------------
expires_count="$(field_lines Expires | grep -c . || true)"
if [ "${expires_count}" -ne 1 ]; then
  fail "${file}: expected exactly one 'Expires:' field, found ${expires_count} (RFC 9116 section 2.5.5)"
fi

expires_value="$(field_lines Expires | sed -n "${field_prefix_sed}")"
expires_re='^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])'
# `60` in the seconds field is a leap second, which RFC 3339 section 5.6 permits
# -- but one is only ever inserted as the LAST second of a UTC day, so 23:59:60
# is a real instant and :60 at any other time is not, however permissive the bare
# ABNF is.
expires_re="${expires_re}T(([01][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]|23:59:60)Z$"
if ! printf '%s' "${expires_value}" | grep -qE "${expires_re}"; then
  fail "${file}: Expires '${expires_value}' is not an RFC 3339 UTC timestamp (YYYY-MM-DDThh:mm:ssZ)"
fi

# The pattern above accepts any day 01-31 for any month, so 2027-02-31 would slip
# through and days_from_civil would silently normalise it into a DIFFERENT expiry
# (3 March). Reject impossible calendar dates outright rather than publishing a
# policy whose stated expiry is not the one enforced.
expires_date="${expires_value%%T*}"
if ! is_real_calendar_date "${expires_date}"; then
  fail "${file}: Expires '${expires_value}' is not a real calendar date"
fi

# --- Days remaining ------------------------------------------------------------
# Pure-arithmetic civil-date conversion (Howard Hinnant's days_from_civil), so
# the gate needs neither GNU `date -d` (absent on macOS/BSD) nor busybox
# extensions -- only `date -u +%Y-%m-%d`, which every supported shell provides.
# Comparing civil day numbers also sidesteps timezones and DST entirely.
days_remaining="$(
  awk -v expiry="${expires_value%%T*}" -v now="${today}" '
    function days_from_civil(y, m, d,   era, yoe, doy, doe) {
      y += (m <= 2) ? -1 : 0
      era = int((y >= 0 ? y : y - 399) / 400)
      yoe = y - era * 400
      doy = int((153 * (m + (m > 2 ? -3 : 9)) + 2) / 5) + d - 1
      doe = yoe * 365 + int(yoe / 4) - int(yoe / 100) + doy
      return era * 146097 + doe - 719468
    }
    function to_days(s,   p) {
      split(s, p, "-")
      return days_from_civil(p[1] + 0, p[2] + 0, p[3] + 0)
    }
    BEGIN { print to_days(expiry) - to_days(now) }
  '
)"

if [ "${days_remaining}" -lt 0 ]; then
  fail "Expires ${expires_value} already passed (today ${today}); RFC 9116 consumers now ignore ${file} -- bump Expires"
fi
if [ "${days_remaining}" -lt "${MIN_DAYS_REMAINING}" ]; then
  fail "only ${days_remaining} days left before Expires ${expires_value} (floor ${MIN_DAYS_REMAINING}); bump Expires, never lower the floor"
fi
if [ "${days_remaining}" -gt "${MAX_DAYS_AHEAD}" ]; then
  fail "Expires ${expires_value} is ${days_remaining} days away, over the ${MAX_DAYS_AHEAD}-day ceiling (RFC 9116 section 2.5.5 recommends under a year); bump Expires down"
fi

echo "security-txt: OK (${file}: ${contacts} Contact field(s), expires ${expires_value}, ${days_remaining} days left)"
