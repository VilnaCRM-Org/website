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

# ---------------------------------------------------------------------------
# Executor selection (issue #399). These four tests pin the contract that makes
# a local `make <target>` and the CI invocation the same command: the container
# is the default everywhere, the host path is reachable only by explicitly
# asking for it, and no ambient environment variable can silently swap them.
# ---------------------------------------------------------------------------

@test "npm-tool gates exec into the dev container by default" {
  reset_command_log
  run_make_target lint-next
  [ "$status" -eq 0 ]
  assert_log_contains 'compose exec -T dev'

  reset_command_log
  run_make_target ci-test-unit-client
  [ "$status" -eq 0 ]
  assert_log_contains 'compose exec -T dev env TEST_ENV=client'
}

@test "EXEC_MODE=host runs the same gates straight from BIN_DIR" {
  reset_command_log
  run_make_target lint-next EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'eslint'
  run grep -c 'compose exec' "$COMMAND_LOG"
  [ "$output" -eq 0 ]
}

@test "the ambient CI variable does not select the host executor" {
  # The regression this issue exists to fix: GitHub Actions exports CI=true into
  # every step, and the previous `ifeq ($(CI),1)` switch turned that into "run
  # on the host", so no CI job ever exercised the container path.
  local ci_value
  for ci_value in 1 true TRUE; do
    reset_command_log
    CI="$ci_value" run_make_target lint-next
    [ "$status" -eq 0 ]
    assert_log_contains 'compose exec -T dev'
  done
}

@test "EXEC_MODE=host needs no Docker daemon, even for the CI aggregates" {
  # The escape hatch exists so the Husky hooks work with Docker stopped. A
  # container-reconciling PREREQUISITE (as opposed to a recipe prefix) does not
  # vanish in host mode by itself, so these entrypoints would otherwise still
  # demand a daemon.
  local target
  for target in ci-lint ci-test ci-mutation update-contracts; do
    reset_command_log
    run_make_target "$target" EXEC_MODE=host
    [ "$status" -eq 0 ]
    run grep -c 'docker' "$COMMAND_LOG"
    [ "$output" -eq 0 ]
  done
}

@test "an unrecognised EXEC_MODE fails loudly instead of falling back" {
  run_make_target lint-next EXEC_MODE=hostt
  [ "$status" -ne 0 ]
  assert_output_contains "EXEC_MODE must be 'container' or 'host'"
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
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && npm install -g bun@1.3.5 && bun install --frozen-lockfile'

  reset_command_log
  run_make_target run-unit-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make test-unit-client EXEC_MODE=host'
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make test-unit-server EXEC_MODE=host'

  reset_command_log
  run_make_target run-mutation-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && bun x stryker run'

  reset_command_log
  run_make_target run-eslint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-next EXEC_MODE=host'

  reset_command_log
  run_make_target run-typescript-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-tsc EXEC_MODE=host'

  reset_command_log
  run_make_target run-markdown-lint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-md EXEC_MODE=host'

  reset_command_log
  run_make_target run-deps-lint-tests-dind TEMP_CONTAINER_NAME=website-dev-test
  [ "$status" -eq 0 ]
  assert_log_contains 'docker exec website-dev-test sh -lc cd /app && make lint-deps EXEC_MODE=host'
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
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml up -d --wait --build memory-leak'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml exec -T memory-leak rm -rf ./src/test/memory-leak/results'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml exec -T memory-leak sh -lc unset DISPLAY;'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml down'
}

@test "developer convenience targets call the expected local commands" {
  reset_command_log
  run_make_target start EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'next dev'

  reset_command_log
  run_make_target wait-for-dev
  [ "$status" -eq 0 ]
  assert_output_contains 'Dev service is up and running!'
  assert_log_contains 'curl -fsS http://localhost:3000'

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
  run_make_target format EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'prettier **/*.{js,jsx,mjs,ts,tsx,json,css,scss,md} --write --ignore-path .prettierignore'

  reset_command_log
  run_make_target husky
  [ "$status" -eq 0 ]
  assert_log_contains 'bun x husky install'

  reset_command_log
  run_make_target storybook-start EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'storybook dev -p'

  reset_command_log
  run_make_target storybook-build EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'storybook build --output-dir storybook-static-ci'

  reset_command_log
  run_make_target check-node-version EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'node checkNodeVersion.js'

  reset_command_log
  run_make_target update
  [ "$status" -eq 0 ]
  assert_log_contains 'bun update'
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

@test "accessibility targets run both gates through Jest and Playwright" {
  # `env TEST_ENV=...` is consumed by the real `env` before the stub sees argv,
  # so echo the variable from the stub instead — the same technique the
  # ci-test split-target test uses, and the only one that holds in both the
  # host (EXEC_MODE=host) and container (EXEC_MODE=container) modes.
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  reset_command_log
  run_make_target test-a11y-components EXEC_MODE=host
  [ "$status" -eq 0 ]
  # The component leg is the client Jest layer, scoped to the a11y spec. Coverage
  # is off because the client suite's global floor cannot be met by one spec; it
  # stays enforced on the full test-unit-client run.
  assert_log_contains 'jest TEST_ENV=client --verbose --coverage=false ./src/test/testing-library/A11yComponents.test.tsx'

  reset_command_log
  run_make_target test-a11y-routes EXEC_MODE=host
  [ "$status" -eq 0 ]
  # The route leg boots the prod stack before scanning, exactly like e2e/visual.
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml up -d'
  assert_log_contains 'playwright test ./src/test/a11y'

  reset_command_log
  run_make_target ci-test-a11y EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/a11y'

  reset_command_log
  run_make_target test-a11y EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=client --verbose --coverage=false ./src/test/testing-library/A11yComponents.test.tsx'
  assert_log_contains 'playwright test ./src/test/a11y'
}

@test "e2e flake targets repeat the changed specs and grade the report" {
  reset_command_log
  run_make_target test-e2e-burnin
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test ./src/test/e2e --repeat-each=5 --retries=0'
  assert_log_contains 'PLAYWRIGHT_JSON_REPORT=burn-in-results/results.json'

  reset_command_log
  run_make_target test-e2e-burnin E2E_BURNIN_SPECS=src/test/e2e/a.spec.ts E2E_BURNIN_REPEATS=3
  [ "$status" -eq 0 ]
  assert_log_contains 'playwright test src/test/e2e/a.spec.ts --repeat-each=3 --retries=0'

  reset_command_log
  run_make_target check-e2e-flakes
  [ "$status" -eq 0 ]
  assert_log_contains 'bun scripts/ci/check-flaky-report.ts'
}

@test "maintenance targets shell out through Docker and Bun as expected" {
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

  run_make_target test-integration EXEC_MODE=host
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

  run_make_target test-integration-watch EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=integration --watch'
}

@test "test-contract runs Jest in the contract environment" {
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  run_make_target test-contract EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=contract --verbose'
}

@test "ensure-dev starts the dev container without waiting for the dev server" {
  run_make_target ensure-dev
  [ "$status" -eq 0 ]
  # It must NOT delegate to `make start`: the gates only need something to exec
  # into, and start would block on wait-for-dev until the Next dev server answers
  # on port 3000. `--no-recreate` is equally load-bearing — without it this would
  # tear down the idle container `ci-setup` created through the CI overlay (a
  # different compose config hash) and replace it with a Next dev server.
  assert_log_contains 'compose -f docker-compose.yml up -d --no-recreate dev'
  run grep -c 'next dev' "$COMMAND_LOG"
  [ "$output" -eq 0 ]
}

@test "ci-setup brings the dev service up idle through the CI compose overlay" {
  run_make_target ci-setup
  [ "$status" -eq 0 ]
  # The overlay replaces the dev server with an idle command, so the container
  # is ready as soon as it is running -- `--wait` replaces the HTTP poll, and
  # no `--build` is passed so a pre-built, layer-cached image is reused.
  assert_log_contains 'docker compose -f docker-compose.yml -f docker-compose.ci.yml up -d --no-recreate --wait dev'
}

@test "ci-setup refuses a dev container bound to a different checkout" {
  # ci-setup is the documented precondition of every ci-test-* entrypoint, and
  # those carry no $(DEV_READY) -- so if `--no-recreate` adopted another
  # checkout's website-dev here, the whole CI lane would run against its /app
  # bind and report green for the wrong source tree.
  run_make_target ci-setup FAKE_DOCKER_APP_BIND=/somewhere/else
  [ "$status" -ne 0 ]
  assert_output_contains 'belongs to a different checkout'
  run grep -cF -- '--wait dev' "$COMMAND_LOG"
  [ "$output" -eq 0 ]
}

@test "start refuses a dev container bound to a different checkout" {
  # `make start` is the developer-facing path that creates or adopts website-dev.
  # Unguarded, a second checkout would either serve the first one's /app bind or
  # replace it -- the same hazard ensure-dev, ci-setup and test-mutation guard.
  run_make_target start FAKE_DOCKER_APP_BIND=/somewhere/else
  [ "$status" -ne 0 ]
  assert_output_contains 'belongs to a different checkout'
  run grep -cF -- 'up -d dev' "$COMMAND_LOG"
  [ "$output" -eq 0 ]
}

@test "ci-lint runs the lint phase through the parallel runner with grouped output" {
  run_make_target ci-lint
  [ "$status" -eq 0 ]
  assert_output_contains '===== lint-next ====='
  assert_output_contains '===== lint-tsc ====='
  assert_output_contains '===== lint-md ====='
  assert_output_contains '===== lint-headers ====='
  assert_output_contains '===== lint-prod-guardrails ====='
}

@test "ci-test runs the dev-side test phase through the parallel runner" {
  run_make_target ci-test
  [ "$status" -eq 0 ]
  assert_output_contains '===== ci-test-unit-client ====='
  assert_output_contains '===== ci-test-unit-server ====='
  assert_output_contains '===== ci-test-integration ====='
  assert_output_contains '===== ci-test-contract ====='
}

@test "ci-test split targets invoke Jest directly with the right TEST_ENV" {
  cat > "$STUB_BIN_DIR/jest" <<'STUB'
#!/usr/bin/env bash
printf 'jest TEST_ENV=%s %s\n' "${TEST_ENV:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/jest"

  run_make_target ci-test-unit-client EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=client --verbose'

  reset_command_log
  run_make_target ci-test-integration EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=integration --verbose'

  reset_command_log
  run_make_target ci-test-unit-server EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'jest TEST_ENV=server --verbose ./src/test/apollo-server'

  reset_command_log
  run_make_target ci-test-mutation EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'bun x stryker run'
}

@test "ci-mutation delegates to ci-test-mutation" {
  run_make_target ci-mutation EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'bun x stryker run'
}

@test "test-mutation refuses a dev container bound to a different checkout" {
  # This target force-recreates with --renew-anon-volumes, so from a second
  # checkout it would DESTROY the other one's container and its anonymous
  # node_modules volume rather than merely adopt it. The guard has to refuse
  # before the recreate is ever issued.
  run_make_target test-mutation FAKE_DOCKER_APP_BIND=/somewhere/else
  [ "$status" -ne 0 ]
  assert_output_contains 'belongs to a different checkout'
  run grep -cF -- '--force-recreate' "$COMMAND_LOG"
  [ "$output" -eq 0 ]
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
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml up -d --wait --build memory-leak'
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
  assert_log_contains 'playwright test ./src/test/a11y'
  assert_log_contains 'lhci autorun --config=lighthouserc.desktop.js'
  assert_log_contains 'lhci autorun --config=lighthouserc.mobile.js'
}

@test "ci runs the full local CI pipeline end to end" {
  run_make_target ci EXEC_MODE=host
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

  # Host-only: never routed through the dev container (docker) or the package manager (bun).
  run grep -E 'docker|bun' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

# Provisions the lint-openapi sandbox: an already-installed oasdiff stub whose
# `breaking` exit code the caller chooses, the committed baseline, and a curl
# stub that "downloads" the upstream spec. UPSTREAM_REF short-circuits the
# releases-API lookup, so the target is exercised without touching the network.
setup_openapi_drift_sandbox() {
  local breaking_exit="$1"

  reset_command_log

  mkdir -p "$MAKEFILE_SANDBOX/bin"
  cat > "$MAKEFILE_SANDBOX/bin/oasdiff" <<STUB
#!/usr/bin/env bash
if [ "\$1" = "--version" ]; then
  echo "oasdiff version 1.27.0"
  exit 0
fi
echo 'stubbed oasdiff output'
exit ${breaking_exit}
STUB
  chmod +x "$MAKEFILE_SANDBOX/bin/oasdiff"

  mkdir -p "$MAKEFILE_SANDBOX/contracts/user-service"
  cp "$PROJECT_ROOT/contracts/user-service/openapi.json" \
    "$MAKEFILE_SANDBOX/contracts/user-service/"

  cat > "$STUB_BIN_DIR/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
destination=""
previous=""
for argument in "$@"; do
  [ "$previous" = "-o" ] && destination="$argument"
  previous="$argument"
done
if [ -n "$destination" ] && [ -n "${STUB_SPEC_SOURCE:-}" ]; then
  cp "$STUB_SPEC_SOURCE" "$destination"
fi
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/curl"

  export STUB_SPEC_SOURCE="$MAKEFILE_SANDBOX/contracts/user-service/openapi.json"
  export UPSTREAM_REF="v0.0.0-stub"
}

# GNU make collapses every recipe failure to its own exit 2, so the three-way
# contract can only be asserted against the script. openapi-drift.yml calls it
# the same way for the same reason.
run_openapi_drift_script() {
  run env -C "$MAKEFILE_SANDBOX" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    OASDIFF_BIN="./bin/oasdiff" \
    STUB_SPEC_SOURCE="$STUB_SPEC_SOURCE" \
    UPSTREAM_REF="$UPSTREAM_REF" \
    bash scripts/ci/openapi-drift.sh
}

@test "lint-openapi provisions the pinned oasdiff then reports a clean baseline host-only" {
  setup_openapi_drift_sandbox 0

  run_make_target lint-openapi
  [ "$status" -eq 0 ]
  assert_output_contains 'No breaking changes'

  # Host-only: never routed through the dev container (docker) or the package manager (bun).
  run grep -E 'docker|bun' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "the drift script writes a report and exits 1 when upstream has breaking changes" {
  setup_openapi_drift_sandbox 1

  run_openapi_drift_script
  [ "$status" -eq 1 ]
  assert_output_contains 'Breaking changes found'
  [ -s "$MAKEFILE_SANDBOX/reports/openapi-drift.md" ]
}

@test "the drift script reports a tool failure as unavailable, never as drift" {
  # oasdiff exits 100 on flag misuse and 102 when it cannot load a spec. Either
  # must surface as "unavailable" (2), never as an upstream API change (1) —
  # otherwise a broken nightly is indistinguishable from a clean one.
  setup_openapi_drift_sandbox 100

  run_openapi_drift_script
  [ "$status" -eq 2 ]
  assert_output_contains 'this is not a drift report'
}

@test "the oasdiff pin is identical in the Makefile and its provisioning script" {
  # The Makefile documents the pin at the top and passes it down; the script
  # carries the same values as defaults so the nightly, which calls the script
  # directly, provisions the very same verified binary. They must never drift.
  local makefile_version script_version makefile_digest script_digest

  makefile_version="$(sed -n 's/^OASDIFF_VERSION[[:space:]]*=[[:space:]]*//p' "$PROJECT_ROOT/Makefile")"
  makefile_digest="$(sed -n 's/^OASDIFF_SHA256_LINUX[[:space:]]*=[[:space:]]*//p' "$PROJECT_ROOT/Makefile")"
  script_version="$(sed -n 's/^OASDIFF_VERSION="\${OASDIFF_VERSION:-\(.*\)}"$/\1/p' \
    "$PROJECT_ROOT/scripts/ci/ensure-oasdiff.sh")"
  script_digest="$(sed -n 's/^OASDIFF_SHA256_LINUX="\${OASDIFF_SHA256_LINUX:-\(.*\)}"$/\1/p' \
    "$PROJECT_ROOT/scripts/ci/ensure-oasdiff.sh")"

  [ -n "$makefile_version" ]
  [ -n "$makefile_digest" ]
  [ "$makefile_version" = "$script_version" ]
  [ "$makefile_digest" = "$script_digest" ]
}

@test "lint-workflows audits the workflows through the digest-pinned zizmor image host-only" {
  reset_command_log

  mkdir -p "$MAKEFILE_SANDBOX/.github/workflows"

  # A token is supplied so the target does not fall back to `gh auth token` and
  # pull a real credential into the command log.
  run_make_target lint-workflows GH_TOKEN=stub-token
  [ "$status" -eq 0 ]

  # The gate must reach zizmor by immutable digest, at the committed floor, and
  # aimed at the workflows -- a dropped threshold or a tag pin would leave a
  # green check that audits nothing.
  assert_log_contains 'ghcr.io/zizmorcore/zizmor@sha256:'
  assert_log_contains '--min-severity medium'
  assert_log_contains '--min-confidence high'
  assert_log_contains '.github/workflows/'

  # Host-only: zizmor is a container CLI, never routed through the dev
  # container's package manager.
  run grep -E 'bun|npm' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "lint-security-txt validates the committed RFC 9116 security.txt" {
  reset_command_log

  # Run the real gate against the real committed policy file (the lint-metrics
  # precedent): a stubbed check would prove only that the recipe fires, not that
  # the shipped security.txt still satisfies RFC 9116 and has expiry runway.
  mkdir -p "$MAKEFILE_SANDBOX/public/.well-known"
  cp "$PROJECT_ROOT/public/.well-known/security.txt" "$MAKEFILE_SANDBOX/public/.well-known/"

  run_make_target lint-security-txt
  [ "$status" -eq 0 ]
  assert_output_contains 'security-txt: OK'

  # Pure bash: never routed through the dev container or the package manager.
  run grep -E 'docker|bun' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "lint-prod-guardrails shells out to the hermetic policy script" {
  reset_command_log

  run_make_target lint-prod-guardrails EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'node scripts/ci/lint-prod-guardrails.mjs'

  # Hermetic: no container, no package manager, and no network client.
  run grep -E 'docker|bun|curl' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "contract targets shell out to Node and cover fetch, lint, checksum and baseline refresh" {
  reset_command_log

  run_make_target lint-contracts EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'node scripts/contracts/lint-contracts.mjs'

  reset_command_log

  run_make_target update-contracts EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'node scripts/fetchSwaggerSchema.mjs'
  assert_log_contains 'node scripts/fetchGraphqlSchema.mjs'
  assert_log_contains 'node scripts/contracts/lint-contracts.mjs --update-checksums'
  assert_log_contains 'node scripts/contracts/lint-contracts.mjs --update-baseline'
}

# Issue #381 / F4: the user-service version invariant is hermetic, so unlike
# lint-contracts it is part of the `lint` aggregate and runs on every PR.
@test "lint-api-versions shells out to the hermetic version-invariant check" {
  reset_command_log

  run_make_target lint-api-versions EXEC_MODE=host
  [ "$status" -eq 0 ]
  assert_log_contains 'node scripts/contracts/check-api-versions.mjs'
}

@test "the lint aggregate includes the API version invariant" {
  run grep -E '^lint: .*lint-api-versions' "$PROJECT_ROOT/Makefile"
  [ "$status" -eq 0 ]

  run grep -E '^CI_LINT_TARGETS .*lint-api-versions' "$PROJECT_ROOT/Makefile"
  [ "$status" -eq 0 ]
}
