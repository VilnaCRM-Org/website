#!/usr/bin/env bats
#
# Coverage for the bounded readiness waits, `make wait-for-dev` and
# `make wait-for-prod` (issue #331).
#
# The happy path of both was already covered, but the shared curl stub in
# test_helper.bash always answers 0, so nothing ever proved the TIMEOUT path:
# that a service which never answers makes the target exit non-zero, after a
# bounded number of probes, printing the container's own logs. wait-for-prod
# in particular used to be an unbounded `while ! curl` loop, which turned a
# dead prod service into a job printing dots until its timeout-minutes with
# the actual cause never shown. Each case here runs in milliseconds:
# MAX_TRIES=1 or 2 and SLEEP=0.

load './test_helper.bash'

# A curl that never succeeds: the "service is down" machine.
create_failing_curl_stub() {
  cat >"$STUB_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
exit 7
EOF

  chmod +x "$STUB_BIN_DIR/curl"
}

count_probes() {
  grep -c -F -- "$1" "$COMMAND_LOG" || true
}

setup() {
  setup_makefile_test_env
}

# --- wait-for-prod ---------------------------------------------------------------

@test "wait-for-prod succeeds on the first healthy probe" {
  run_make_target wait-for-prod WAIT_FOR_PROD_MAX_TRIES=3 WAIT_FOR_PROD_SLEEP=0

  [ "$status" -eq 0 ]
  assert_output_contains 'Prod service is up and running!'
  [ "$(count_probes 'curl -s -f http://localhost:3001')" -eq 1 ]
  # Nothing to diagnose, so no log dump.
  run grep -F 'logs --tail=50 prod' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "wait-for-prod times out, exits non-zero and dumps the prod logs when the service never answers" {
  create_failing_curl_stub

  run_make_target wait-for-prod WAIT_FOR_PROD_MAX_TRIES=1 WAIT_FOR_PROD_SLEEP=0

  [ "$status" -ne 0 ]
  assert_output_contains 'Timed out waiting for the prod service'
  refute_output_contains 'Prod service is up and running!'
  assert_log_contains 'docker compose -f docker-compose.test.yml logs --tail=50 prod'
}

@test "wait-for-prod probes exactly WAIT_FOR_PROD_MAX_TRIES times before giving up" {
  # The bound is the whole point: an unbounded loop would never reach the
  # assertion at all.
  create_failing_curl_stub

  run_make_target wait-for-prod WAIT_FOR_PROD_MAX_TRIES=2 WAIT_FOR_PROD_SLEEP=0

  [ "$status" -ne 0 ]
  [ "$(count_probes 'curl -s -f http://localhost:3001')" -eq 2 ]
}

@test "wait-for-prod reports the budget it exhausted in seconds" {
  create_failing_curl_stub

  run_make_target wait-for-prod WAIT_FOR_PROD_MAX_TRIES=2 WAIT_FOR_PROD_SLEEP=0

  [ "$status" -ne 0 ]
  assert_output_contains 'after 0 seconds'
}

# --- wait-for-dev ----------------------------------------------------------------

@test "wait-for-dev succeeds on the first healthy probe" {
  run_make_target wait-for-dev WAIT_FOR_DEV_MAX_TRIES=3 WAIT_FOR_DEV_SLEEP=0

  [ "$status" -eq 0 ]
  assert_output_contains 'Dev service is up and running!'
  [ "$(count_probes 'curl -fsS http://localhost:3000')" -eq 1 ]
  run grep -F 'logs --tail=50 dev' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "wait-for-dev times out, exits non-zero and dumps the dev logs when the service never answers" {
  create_failing_curl_stub

  run_make_target wait-for-dev WAIT_FOR_DEV_MAX_TRIES=1 WAIT_FOR_DEV_SLEEP=0

  [ "$status" -ne 0 ]
  assert_output_contains 'Timed out waiting for the dev service'
  refute_output_contains 'Dev service is up and running!'
  assert_log_contains 'docker compose -f docker-compose.yml logs --tail=50 dev'
}

@test "wait-for-dev probes exactly WAIT_FOR_DEV_MAX_TRIES times before giving up" {
  create_failing_curl_stub

  run_make_target wait-for-dev WAIT_FOR_DEV_MAX_TRIES=2 WAIT_FOR_DEV_SLEEP=0

  [ "$status" -ne 0 ]
  [ "$(count_probes 'curl -fsS http://localhost:3000')" -eq 2 ]
}

@test "the failing curl stub really fails, so the timeout cases are not vacuous" {
  create_failing_curl_stub

  run env PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" curl -s -f http://localhost:3001
  [ "$status" -eq 7 ]
}
