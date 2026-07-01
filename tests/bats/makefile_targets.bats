#!/usr/bin/env bats

load './test_helper.bash'

setup() {
  setup_makefile_test_env
}

@test "help lists the Bats entry point" {
  run_make_target help
  [ "$status" -eq 0 ]
  assert_output_contains 'Usage:'
  assert_output_contains 'test-bats'
}

@test "container-backed helper targets fail fast when their required names are missing" {
  local target
  local required_var

  while IFS='|' read -r target required_var; do
    unset "$required_var"
    run_make_target "$target"
    [ "$status" -ne 0 ]
    assert_output_contains "Error: $required_var is required."
  done <<'EOF'
create-temp-dev-container-dind|TEMP_CONTAINER_NAME
copy-source-to-container-dind|TEMP_CONTAINER_NAME
install-deps-in-container-dind|TEMP_CONTAINER_NAME
run-unit-tests-dind|TEMP_CONTAINER_NAME
run-mutation-tests-dind|TEMP_CONTAINER_NAME
run-eslint-tests-dind|TEMP_CONTAINER_NAME
run-typescript-tests-dind|TEMP_CONTAINER_NAME
run-markdown-lint-tests-dind|TEMP_CONTAINER_NAME
run-deps-lint-tests-dind|TEMP_CONTAINER_NAME
create-k6-helper-container-dind|K6_HELPER_NAME
run-load-tests-dind|K6_HELPER_NAME
EOF
}

@test "DIND dev-container targets shell out through docker with the expected commands" {
  reset_command_log
  run_make_target create-temp-dev-container-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker rm -f website-dev-test'
  assert_log_contains 'docker compose -f docker-compose.yml run -d --name website-dev-test --entrypoint sh dev -lc sleep infinity'

  reset_command_log
  run_make_target copy-source-to-container-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc mkdir -p /app'
  assert_log_contains 'tar -cf -'
  assert_log_contains 'docker exec -i website-dev-test sh -lc tar -xf - -C /app'

  reset_command_log
  run_make_target install-deps-in-container-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && npm install -g pnpm && pnpm install --frozen-lockfile'

  reset_command_log
  run_make_target run-unit-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make test-unit-client CI=1'
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make test-unit-server CI=1'

  reset_command_log
  run_make_target run-mutation-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && pnpm stryker run'

  reset_command_log
  run_make_target run-eslint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-next CI=1'

  reset_command_log
  run_make_target run-typescript-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-tsc CI=1'

  reset_command_log
  run_make_target run-markdown-lint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-md CI=1'

  reset_command_log
  run_make_target run-deps-lint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-deps CI=1'
}

@test "K6 and DIND quality targets invoke the expected Docker commands" {
  reset_command_log
  run_make_target create-k6-helper-container-dind K6_HELPER_NAME=website-k6-helper
  [ "$status" -eq 0 ]
  assert_log_contains 'docker rm -f website-k6-helper'
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml --profile load run -d --name website-k6-helper --entrypoint sh k6 -lc tail -f /dev/null'

  reset_command_log
  run_make_target build-k6
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml --profile load build k6'

  reset_command_log
  run_make_target run-load-tests-dind K6_HELPER_NAME=website-k6-helper
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec -w /loadTests website-k6-helper k6 run --summary-trend-stats=avg,min,med,max,p(95),p(99) --out web-dashboard=period=1s&export=/loadTests/results/homepage.html /loadTests/homepage.js'

  reset_command_log
  run_make_target memory-leak-dind
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml up -d --wait memory-leak'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml exec -T memory-leak rm -rf ./src/test/memory-leak/results'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml exec -T memory-leak sh -lc unset DISPLAY;'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml down'
}

@test "developer convenience targets call the expected local commands" {
  reset_command_log
  run_make_target start CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'next dev'

  reset_command_log
  run_make_target wait-for-dev
  [ "$status" -eq 0 ]
  assert_output_contains 'Dev service is up and running!'
  assert_log_contains 'curl -s -f http://localhost:3000'

  reset_command_log
  run_make_target build-analyze
  [ "$status" -eq 0 ]
  assert_log_contains 'next build --webpack'
  assert_log_contains 'next-export-optimize-images'

  reset_command_log
  run_make_target build-out
  [ "$status" -eq 0 ]
  assert_log_contains 'docker build -t next-build -f Dockerfile --target production .'
  assert_log_contains 'docker create next-build'
  assert_log_contains 'docker cp fake-container-id:/app/out ./'
  assert_log_contains 'docker rm fake-container-id'

  reset_command_log
  run_make_target format CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm ./node_modules/.bin/prettier **/*.{js,jsx,ts,tsx,json,css,scss,md} --write --ignore-path .prettierignore'

  reset_command_log
  run_make_target husky
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm husky install'

  reset_command_log
  run_make_target storybook-start CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'storybook dev -p'

  reset_command_log
  run_make_target storybook-build CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'storybook build --output-dir storybook-static-ci'

  reset_command_log
  run_make_target check-node-version CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm exec node checkNodeVersion.js'

  reset_command_log
  run_make_target update
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm update'
}

@test "prod-side wrapper targets invoke the expected Docker and Playwright flows" {
  reset_command_log
  run_make_target wait-for-prod
  [ "$status" -eq 0 ]
  assert_output_contains 'Prod service is up and running!'
  assert_log_contains 'curl -s -f http://localhost:3001'

  reset_command_log
  run_make_target test-e2e-ui
  [ "$status" -eq 0 ]
  assert_log_contains 'docker network ls'
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml up -d'
  assert_log_contains 'docker compose -f docker-compose.test.yml ps'
  assert_log_contains 'playwright test ./src/test/e2e'
  assert_log_contains '--ui-port=9324 --ui-host=0.0.0.0'

  reset_command_log
  run_make_target test-visual-ui
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/visual'
  assert_log_contains '--ui-port=9324 --ui-host=0.0.0.0'

  reset_command_log
  run_make_target test-visual-update
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/visual --update-snapshots'

  reset_command_log
  run_make_target visual-direct
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/visual'

  reset_command_log
  run_make_target e2e-direct
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/e2e'
}

@test "maintenance targets shell out through Docker and pnpm as expected" {
  reset_command_log
  run_make_target lighthouse-desktop-dind
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f docker-compose.test.yml exec -T -w /app prod lhci autorun --config=lighthouserc.desktop.js'

  reset_command_log
  run_make_target lighthouse-mobile-dind
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f docker-compose.test.yml exec -T -w /app prod lhci autorun --config=lighthouserc.mobile.js'

  reset_command_log
  run_make_target install-chromium-lhci
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f docker-compose.test.yml exec -T prod sh -lc apk add --no-cache chromium chromium-chromedriver && npm install -g @lhci/cli@0.14.0'

  reset_command_log
  run_make_target test-chromium
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f docker-compose.test.yml exec -T prod /usr/bin/chromium-browser --version'

  reset_command_log
  run_make_target down
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose down --remove-orphans'

  reset_command_log
  run_make_target sh
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose exec dev sh'

  reset_command_log
  run_make_target ps
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose ps'

  reset_command_log
  run_make_target logs
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose logs --follow dev'

  reset_command_log
  run_make_target new-logs
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose logs --tail=0 --follow dev'

  reset_command_log
  run_make_target stop
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose stop'

  reset_command_log
  run_make_target all
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose build'

  reset_command_log
  run_make_target clean
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose down --remove-orphans'
}

@test "test-integration runs Jest in the integration environment" {
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  run_make_target test-integration CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=integration --verbose'
}

@test "test-integration-watch runs Jest in watch mode for the integration environment" {
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  run_make_target test-integration-watch CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=integration --watch'
}

@test "ensure-dev starts the dev service when it is not already running" {
  run_make_target ensure-dev CI=1
  [ "$status" -eq 0 ]
  # The stubbed docker compose ps does not report a running 'dev' service,
  # so ensure-dev falls back to 'make start'.
  assert_log_contains 'next dev'
}

@test "ci-setup brings up the dev service and waits for readiness" {
  run_make_target ci-setup CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f docker-compose.yml up -d --build dev'
  assert_output_contains 'Dev service is up and running!'
}

@test "ci-lint runs the lint phase through the parallel runner with grouped output" {
  run_make_target ci-lint CI=1
  [ "$status" -eq 0 ]
  assert_output_contains '===== lint-next ====='
  assert_output_contains '===== lint-tsc ====='
  assert_output_contains '===== lint-md ====='
}

@test "ci-test runs the dev-side test phase through the parallel runner" {
  run_make_target ci-test CI=1
  [ "$status" -eq 0 ]
  assert_output_contains '===== ci-test-unit-client ====='
  assert_output_contains '===== ci-test-unit-server ====='
  assert_output_contains '===== ci-test-integration ====='
}

@test "ci-test split targets invoke Jest directly with the right TEST_ENV" {
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  run_make_target ci-test-unit-client CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=client --verbose'

  reset_command_log
  run_make_target ci-test-unit-server CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=server --verbose ./src/test/apollo-server'

  reset_command_log
  run_make_target ci-test-mutation CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm exec stryker run'
}

@test "ci-mutation delegates to ci-test-mutation" {
  run_make_target ci-mutation CI=1
  [ "$status" -eq 0 ]
  assert_log_contains 'pnpm exec stryker run'
}

@test "ci-prod-setup starts prod and installs Chromium" {
  run_make_target ci-prod-setup
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml up -d'
  assert_log_contains 'apk add --no-cache chromium chromium-chromedriver'
}

@test "prod-side ci-test split targets dispatch to the prod test flows" {
  run_make_target ci-test-e2e
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/e2e'

  reset_command_log
  run_make_target ci-test-visual
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/visual'

  reset_command_log
  run_make_target ci-test-load
  [ "$status" -eq 0 ]
  assert_log_contains '/loadTests/homepage.js'

  reset_command_log
  run_make_target ci-test-memory-leak
  [ "$status" -eq 0 ]
  # --wait avoids racing the exec against an unready container.
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml up -d --wait memory-leak'
  assert_log_contains 'node ./src/test/memory-leak/runMemlabTests.js'
  # Teardown must be scoped to the isolated memleak project so it never removes
  # the shared prod stack as an orphan mid-sequence in ci-test-prod, and the
  # trap guarantees it runs even if the Memlab run fails.
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml down --remove-orphans'

  reset_command_log
  run_make_target ci-test-lighthouse-desktop
  [ "$status" -eq 0 ]
  assert_log_contains 'lhci autorun --config=lighthouserc.desktop.js'

  reset_command_log
  run_make_target ci-test-lighthouse-mobile
  [ "$status" -eq 0 ]
  assert_log_contains 'lhci autorun --config=lighthouserc.mobile.js'
}

@test "ci-test-prod runs every prod-side phase in sequence" {
  run_make_target ci-test-prod
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/e2e'
  assert_log_contains 'playwright test ./src/test/visual'
  assert_log_contains 'lhci autorun --config=lighthouserc.desktop.js'
  assert_log_contains 'lhci autorun --config=lighthouserc.mobile.js'
}

@test "ci runs the full local CI pipeline end to end" {
  run_make_target ci CI=1
  [ "$status" -eq 0 ]
  assert_output_contains '===== lint-next ====='
  assert_log_contains 'apk add --no-cache chromium'
}

@test "start-prod-clean force-recreates and rebuilds the prod stack" {
  run_make_target start-prod-clean
  [ "$status" -eq 0 ]
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml up -d --force-recreate --build'
}

@test "test-load and test-load-swagger alias the K6 load targets" {
  run_make_target test-load
  [ "$status" -eq 0 ]
  assert_log_contains '/loadTests/homepage.js'

  reset_command_log
  run_make_target test-load-swagger
  [ "$status" -eq 0 ]
  assert_log_contains '/loadTests/swagger.js'
}

@test "pr-comments dispatches to the helper script with PR and FORMAT" {
  cat > "$MAKEFILE_SANDBOX/scripts/get-pr-comments.sh" <<'STUB'
#!/usr/bin/env bash
printf 'get-pr-comments %s\n' "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$MAKEFILE_SANDBOX/scripts/get-pr-comments.sh"

  run_make_target pr-comments PR=123 FORMAT=json
  [ "$status" -eq 0 ]
  assert_log_contains 'get-pr-comments 123 json'

  reset_command_log
  run_make_target pr-comments PR=456
  [ "$status" -eq 0 ]
  assert_log_contains 'get-pr-comments 456'

  reset_command_log
  run_make_target pr-comments FORMAT=markdown
  [ "$status" -eq 0 ]
  assert_log_contains 'get-pr-comments markdown'

  reset_command_log
  run_make_target pr-comments
  [ "$status" -eq 0 ]
  assert_log_contains 'get-pr-comments'
}

@test "lint-metrics provisions the pinned CLI then enforces the policy host-only" {
  reset_command_log

  # Pretend the pinned analyzer is already provisioned so ensure-rca.sh is a
  # no-op (idempotent, no download) and have it emit a minimal in-policy object.
  mkdir -p "$MAKEFILE_SANDBOX/bin"
  cat > "$MAKEFILE_SANDBOX/bin/rust-code-analysis-cli" <<'STUB'
#!/usr/bin/env bash
if [ "$1" = "--version" ]; then
  echo "rust-code-analysis-cli 0.0.25"
  exit 0
fi
echo '{"name":"sample.ts","kind":"unit","spaces":[],"metrics":{}}'
exit 0
STUB
  chmod +x "$MAKEFILE_SANDBOX/bin/rust-code-analysis-cli"

  # The wrapper validates the real committed policy + schema before enforcing.
  mkdir -p "$MAKEFILE_SANDBOX/config"
  cp "$PROJECT_ROOT/config/metrics-policy.json" "$MAKEFILE_SANDBOX/config/"
  cp "$PROJECT_ROOT/config/metrics-policy.schema.json" "$MAKEFILE_SANDBOX/config/"

  run_make_target lint-metrics
  [ "$status" -eq 0 ]
  assert_output_contains 'all hard checks pass'

  # Host-only: never routed through the dev container (docker) or pnpm.
  run grep -E 'docker|pnpm' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}
