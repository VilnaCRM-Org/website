#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-security-txt.sh (issue #383) -- the gate that
# keeps the published RFC 9116 policy from silently expiring. Its failure mode
# is invisible in production (consumers ignore a stale file rather than report
# it), so pin the happy path against the real committed file, every rejection
# path, and BOTH day-count boundaries exactly.
#
# Every fixture below carries the SAME fixed `Expires: 2027-06-30T23:59:59Z`
# and moves the injected clock instead, so this suite never does its own date
# arithmetic and can never drift with the wall clock.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-security-txt.sh'

# Write the fixture from stdin, so each test's file content is literal and
# readable rather than the output of a filter.
write_fixture() {
  cat >"$SEC_TXT"
}

# A complete, valid policy. Reused by the tests that mutate exactly one field.
write_valid_fixture() {
  write_fixture <<'EOF'
# fixture
Contact: https://github.com/VilnaCRM-Org/website/security/advisories/new
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Policy: https://github.com/VilnaCRM-Org/website/blob/main/SECURITY.md
Preferred-Languages: uk, en
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF
}

# Run against a fixture with the clock pinned. `Expires` is fixed at
# 2027-06-30, so the injected date alone decides which boundary is exercised.
run_checker_at() {
  run env SECURITY_TXT_TODAY="$1" bash "$PROJECT_ROOT/$SCRIPT_REL" "$SEC_TXT"
}

# Rewrite only the Expires date, keeping the rest of a valid policy intact.
write_fixture_expiring_on() {
  write_valid_fixture
  sed -i "s/^Expires:.*/Expires: ${1}T23:59:59Z/" "$SEC_TXT"
}

setup() {
  SEC_TXT="$BATS_TEST_TMPDIR/security.txt"
}

@test "passes the committed security.txt on the real clock and the default path" {
  # No SECURITY_TXT_TODAY and no path argument: this is exactly what
  # `make lint-security-txt` runs, so it also asserts the default clock really
  # is `date -u` and the default file really is the committed policy.
  run env -u SECURITY_TXT_TODAY -C "$PROJECT_ROOT" bash "$SCRIPT_REL"
  [ "$status" -eq 0 ]
  assert_output_contains 'security-txt: OK'
  assert_output_contains 'public/.well-known/security.txt'
  assert_output_contains 'Contact field(s)'
  assert_output_contains 'days left'
}

@test "fails when the file is missing" {
  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'missing or empty'
}

@test "fails when the file is empty" {
  : >"$SEC_TXT"

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'missing or empty'
}

@test "fails when no Contact field is present" {
  write_fixture <<'EOF'
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "no 'Contact:' field"
}

@test "fails when the only Contact uses an unsupported URI scheme" {
  write_fixture <<'EOF'
Contact: http://insecure.example.com/report
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "no 'Contact:' field"
}

@test "fails when a second Contact is a bare email address without mailto:" {
  # A malformed sibling used to hide behind a good one: only the acceptable
  # Contact lines were counted, and nothing re-read the rest.
  write_fixture <<'EOF'
Contact: https://github.com/VilnaCRM-Org/website/security/advisories/new
Contact: info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Contact:' value is not an https://, mailto: or tel: URI"
  assert_output_contains 'Contact: info@vilnacrm.com'
}

@test "fails when a second Contact uses plaintext http" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Contact: http://insecure.example.com/report
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Contact:' value is not an https://, mailto: or tel: URI"
}

@test "fails when a Contact field has no value at all" {
  write_fixture <<'EOF'
Contact:
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not an RFC 9116 field line'
}

@test "accepts a mailto: Contact as the sole contact" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 0 ]
  assert_output_contains '1 Contact field(s)'
}

@test "fails when Expires is missing" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "expected exactly one 'Expires:' field, found 0"
}

@test "fails when Expires appears more than once" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Expires: 2027-12-31T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "expected exactly one 'Expires:' field, found 2"
}

@test "fails when Expires is a bare date instead of an RFC 3339 UTC timestamp" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'is not an RFC 3339 UTC timestamp'
}

@test "fails when Expires carries a numeric offset instead of Z" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59+03:00
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'is not an RFC 3339 UTC timestamp'
}

@test "fails when Expires has already passed" {
  write_valid_fixture

  run_checker_at 2028-01-01
  [ "$status" -eq 1 ]
  assert_output_contains 'already passed'
  assert_output_contains 'bump Expires'
}

@test "passes at exactly 60 days remaining" {
  write_valid_fixture

  run_checker_at 2027-05-01
  [ "$status" -eq 0 ]
  assert_output_contains '60 days left'
}

@test "fails at 59 days remaining, telling the reader to bump Expires" {
  write_valid_fixture

  run_checker_at 2027-05-02
  [ "$status" -eq 1 ]
  assert_output_contains 'only 59 days left'
  assert_output_contains '(floor 60)'
  assert_output_contains 'bump Expires, never lower the floor'
}

@test "passes at exactly 366 days ahead" {
  write_valid_fixture

  run_checker_at 2026-06-29
  [ "$status" -eq 0 ]
  assert_output_contains '366 days left'
}

@test "fails at 367 days ahead" {
  write_valid_fixture

  run_checker_at 2026-06-28
  [ "$status" -eq 1 ]
  assert_output_contains '367 days away'
  assert_output_contains '366-day ceiling'
}

@test "the day thresholds cannot be lowered from the environment" {
  # A lowered gate threshold is a policy violation, so the floor and ceiling are
  # hardcoded: exporting them must not turn either boundary green.
  write_valid_fixture

  run env MIN_DAYS_REMAINING=1 MAX_DAYS_AHEAD=99999 SECURITY_TXT_TODAY=2027-05-02 \
    bash "$PROJECT_ROOT/$SCRIPT_REL" "$SEC_TXT"
  [ "$status" -eq 1 ]
  assert_output_contains 'only 59 days left'
  assert_output_contains '(floor 60)'

  run env MIN_DAYS_REMAINING=1 MAX_DAYS_AHEAD=99999 SECURITY_TXT_TODAY=2026-06-28 \
    bash "$PROJECT_ROOT/$SCRIPT_REL" "$SEC_TXT"
  [ "$status" -eq 1 ]
  assert_output_contains '366-day ceiling'
}

@test "fails when Canonical does not point at /.well-known/security.txt" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Canonical:' must be an https URI naming the published policy location"
}

@test "fails when Canonical is missing entirely" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Canonical:' must be an https URI"
}

@test "fails when Canonical names a foreign host" {
  # Only the PATH was pinned before, so a policy canonicalised to someone else's
  # origin shipped green -- and RFC 9116 section 2.5.2 tells consumers to distrust
  # a file whose Canonical is not the URI they fetched.
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Canonical: https://attacker.example.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Canonical:' must be an https URI"
}

@test "fails when Canonical names a host that merely starts with the real one" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com.evil.example/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Canonical:' must be an https URI"
}

@test "fails when a second Canonical names a foreign host" {
  # A correct value must not launder an extra one beside it.
  write_valid_fixture
  printf 'Canonical: https://attacker.example.com/.well-known/security.txt\n' >>"$SEC_TXT"

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "'Canonical:' must be an https URI"
}

@test "fails on a line that is neither a comment, blank, nor a Field: value pair" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
this is not a field
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not an RFC 9116 field line'
  assert_output_contains '2:this is not a field'
}

@test "tolerates comment and blank lines anywhere in the file" {
  write_fixture <<'EOF'
# leading comment

Contact: mailto:info@vilnacrm.com

# an interleaved comment
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt

EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 0 ]
  assert_output_contains 'security-txt: OK'
}

@test "rejects a malformed injected clock instead of computing nonsense" {
  write_valid_fixture

  run_checker_at 'not-a-date'
  [ "$status" -eq 1 ]
  assert_output_contains 'is not a YYYY-MM-DD calendar date'
}

# --- Impossible calendar dates (review finding) --------------------------------
# The RFC 3339 pattern accepts any day 01-31 in any month, so without an explicit
# range check `2027-02-31` would reach the day-delta arithmetic and be silently
# normalised into a DIFFERENT expiry (3 March) -- publishing a policy whose stated
# expiry is not the one enforced.

@test "rejects a day that does not exist in that month" {
  write_fixture_expiring_on 2027-02-31

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not a real calendar date'
}

@test "rejects the 31st of a thirty-day month" {
  write_fixture_expiring_on 2027-04-31

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not a real calendar date'
}

@test "rejects 29 February in a common year" {
  write_fixture_expiring_on 2027-02-29

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not a real calendar date'
}

@test "accepts 29 February in a leap year" {
  # 2028 is a leap year, so this is a real date and must clear the calendar check;
  # it is then legitimately refused by the 366-day ceiling, which proves it got
  # past the date validation rather than being rejected as malformed.
  write_fixture_expiring_on 2028-02-29

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'over the 366-day ceiling'
}

@test "accepts 29 February in a 400-year leap year" {
  # 2000 is divisible by 100 but also by 400, so it IS a leap year -- the case a
  # naive `year % 4` check gets wrong. The clock is set so the date lands inside
  # the 60..366 day window and the run is green on its own merits.
  write_fixture_expiring_on 2000-02-29

  run_checker_at 1999-06-01
  [ "$status" -eq 0 ]
}

@test "rejects 29 February in a 100-year common year" {
  # 2100 is divisible by 100 but not 400, so it is NOT a leap year.
  write_fixture_expiring_on 2100-02-29

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'not a real calendar date'
}

@test "accepts a leap second in the Expires timestamp" {
  # RFC 3339 section 5.6 permits :60 in the seconds field.
  write_valid_fixture
  sed -i 's/^Expires:.*/Expires: 2027-06-30T23:59:60Z/' "$SEC_TXT"

  run_checker_at 2026-07-31
  [ "$status" -eq 0 ]
}

@test "still rejects an out-of-range seconds value" {
  write_valid_fixture
  sed -i 's/^Expires:.*/Expires: 2027-06-30T23:59:61Z/' "$SEC_TXT"

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'is not an RFC 3339 UTC timestamp'
}

@test "rejects an impossible injected clock instead of normalising it" {
  # 2026-02-30 is well-formed but not a date; days_from_civil would silently
  # measure the runway from 2 March instead.
  write_valid_fixture

  run_checker_at 2026-02-30
  [ "$status" -eq 1 ]
  assert_output_contains 'is not a YYYY-MM-DD calendar date'
}

@test "rejects a leap second anywhere but the end of a UTC day" {
  # A leap second is only ever inserted as the last second of a UTC day, so
  # 12:30:60 is not an instant that exists.
  write_valid_fixture
  sed -i 's/^Expires:.*/Expires: 2027-06-15T12:30:60Z/' "$SEC_TXT"

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains 'is not an RFC 3339 UTC timestamp'
}

# --- Case-insensitive field names (RFC 9116 section 4 / RFC 5234 section 2.3) ---
# The names are ABNF string literals, so `expires:` is an Expires field. A
# case-sensitive lookup both rejects a valid file and, worse, reads a duplicate
# as unique.

@test "accepts a policy whose field names are lowercase" {
  write_fixture <<'EOF'
contact: mailto:info@vilnacrm.com
expires: 2027-06-30T23:59:59Z
canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 0 ]
  assert_output_contains 'security-txt: OK'
}

@test "fails when Expires repeats in a different case" {
  write_fixture <<'EOF'
Contact: mailto:info@vilnacrm.com
Expires: 2027-06-30T23:59:59Z
expires: 2020-01-01T00:00:00Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "expected exactly one 'Expires:' field, found 2"
}

@test "still rejects a bad URI scheme when the field name is lowercase" {
  # Only the NAME is case-folded: the value patterns stay byte-exact.
  write_fixture <<'EOF'
contact: http://insecure.example.com/report
Expires: 2027-06-30T23:59:59Z
Canonical: https://vilnacrm.com/.well-known/security.txt
EOF

  run_checker_at 2026-07-31
  [ "$status" -eq 1 ]
  assert_output_contains "no 'Contact:' field"
}
