#!/usr/bin/env bats

load './test_helper.bash'

setup() {
  setup_ci_script_test_env
}

@test "batch_unit_mutation_lint.sh dispatches each DIND flow through existing make targets" {
  local script_path="$PROJECT_ROOT/scripts/ci/batch_unit_mutation_lint.sh"

  run_ci_script "$script_path" test-unit
  [ "$status" -eq 0 ]
  assert_log_contains 'make build'
  assert_log_contains 'make create-temp-dev-container-dind TEMP_CONTAINER_NAME=website-dev-test'
  assert_log_contains 'make copy-source-to-container-dind TEMP_CONTAINER_NAME=website-dev-test'
  assert_log_contains 'make install-deps-in-container-dind TEMP_CONTAINER_NAME=website-dev-test'
  assert_log_contains 'make run-unit-tests-dind TEMP_CONTAINER_NAME=website-dev-test'

  reset_command_log
  run_ci_script "$script_path" test-mutation
  [ "$status" -eq 0 ]
  assert_log_contains 'make run-mutation-tests-dind TEMP_CONTAINER_NAME=website-dev-test'

  reset_command_log
  run_ci_script "$script_path" test-lint
  [ "$status" -eq 0 ]
  assert_log_contains 'make run-eslint-tests-dind TEMP_CONTAINER_NAME=website-dev-lint'
  assert_log_contains 'make run-typescript-tests-dind TEMP_CONTAINER_NAME=website-dev-lint'
  assert_log_contains 'make run-markdown-lint-tests-dind TEMP_CONTAINER_NAME=website-dev-lint'
}

@test "batch_pw_load.sh dispatches its E2E, visual, and load flows through make and docker" {
  local script_path="$PROJECT_ROOT/scripts/ci/batch_pw_load.sh"

  run_ci_script "$script_path" test-e2e
  [ "$status" -eq 0 ]
  assert_log_contains 'make start-prod'
  assert_log_contains 'make test-e2e'
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml exec -T playwright mkdir -p /app'
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml cp playwright:/app/playwright-report/. playwright-report/'

  reset_command_log
  run_ci_script "$script_path" test-visual
  [ "$status" -eq 0 ]
  assert_log_contains 'make start-prod'
  assert_log_contains 'make test-visual'
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml exec -T playwright mkdir -p /app/src/test /app/src/config /app/pages/i18n'

  reset_command_log
  run_ci_script "$script_path" test-load
  [ "$status" -eq 0 ]
  assert_log_contains 'make start-prod'
  assert_log_contains 'make build-k6'
  assert_log_contains 'make create-k6-helper-container-dind K6_HELPER_NAME=website-k6-helper'
  assert_log_contains 'make run-load-tests-dind K6_HELPER_NAME=website-k6-helper'
  assert_log_contains 'docker cp src/test/load/. website-k6-helper:/loadTests/'
}

@test "batch_lhci_leak.sh handles CodeBuild skips and the DIND Lighthouse flows" {
  local script_path="$PROJECT_ROOT/scripts/ci/batch_lhci_leak.sh"

  run env \
    -C "$SCRIPT_SANDBOX" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    CODEBUILD_BUILD_ID=website:1 \
    "$script_path" test-memory-leak
  [ "$status" -eq 0 ]
  assert_output_contains 'Memory leak tests: SKIPPED'

  reset_command_log
  run_ci_script "$script_path" test-lighthouse-desktop
  [ "$status" -eq 0 ]
  assert_log_contains 'make start-prod'
  assert_log_contains 'make install-chromium-lhci'
  assert_log_contains 'make test-chromium'
  assert_log_contains 'make lighthouse-desktop-dind'

  reset_command_log
  run_ci_script "$script_path" test-lighthouse-mobile
  [ "$status" -eq 0 ]
  assert_log_contains 'make start-prod'
  assert_log_contains 'make install-chromium-lhci'
  assert_log_contains 'make test-chromium'
  assert_log_contains 'make lighthouse-mobile-dind'
}
