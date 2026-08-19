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

@test "run-parallel.sh runs the lint phase targets through make and groups output" {
  local script_path="$PROJECT_ROOT/scripts/ci/run-parallel.sh"

  run_ci_script "$script_path" ci-lint lint-next lint-tsc lint-md
  [ "$status" -eq 0 ]
  assert_log_contains 'make lint-next'
  assert_log_contains 'make lint-tsc'
  assert_log_contains 'make lint-md'
  assert_output_contains '===== lint-next ====='
  assert_output_contains '===== lint-md ====='
}

@test "run-parallel.sh runs the test phase targets through make and aggregates failures" {
  local script_path="$PROJECT_ROOT/scripts/ci/run-parallel.sh"

  run_ci_script "$script_path" ci-test ci-test-unit-client ci-test-unit-server ci-test-integration
  [ "$status" -eq 0 ]
  assert_log_contains 'make ci-test-unit-client'
  assert_log_contains 'make ci-test-integration'
  assert_output_contains '===== ci-test-unit-server ====='

  reset_command_log
  run env \
    -C "$SCRIPT_SANDBOX" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    FAKE_MAKE_FAIL_TARGET=ci-test-unit-server \
    "$script_path" ci-test ci-test-unit-client ci-test-unit-server
  [ "$status" -ne 0 ]
  assert_output_contains 'ci-test: ci-test-unit-server failed'
}


run_host_stack() {
  run env \
    -C "$SCRIPT_SANDBOX" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    BIN_DIR="$STUB_BIN_DIR" \
    PORT=3001 \
    WEBSITE_DOMAIN=localhost \
    SWAGGER_SERVER_URL=http://mockoon:8080 \
    "$PROJECT_ROOT/scripts/ci/host-stack.sh" "$@"
}

# Copy every file the pin gate reads into an isolated tree so a mutation never
# touches the working copy.
setup_pin_sandbox() {
  PIN_SANDBOX="$BATS_TEST_TMPDIR/pins"

  mkdir -p "$PIN_SANDBOX/.github/workflows" "$PIN_SANDBOX/scripts/ci"
  cp "$PROJECT_ROOT/.nvmrc" "$PROJECT_ROOT/.bun-version" "$PROJECT_ROOT/package.json" \
    "$PROJECT_ROOT/Makefile" "$PROJECT_ROOT/Dockerfile" "$PIN_SANDBOX/"
  cp "$PROJECT_ROOT"/*.Dockerfile "$PIN_SANDBOX/"
  cp "$PROJECT_ROOT"/.github/workflows/*.yml "$PIN_SANDBOX/.github/workflows/"
  cp "$PROJECT_ROOT/scripts/ci/check-version-pins.mjs" "$PIN_SANDBOX/scripts/ci/"
  # The committed devcontainer is part of the pin surface, so the baseline must be
  # the real file: a synthetic stand-in would let a regression in its build target,
  # remoteEnv, or embedded versions pass this suite.
  mkdir -p "$PIN_SANDBOX/.devcontainer"
  cp "$PROJECT_ROOT/.devcontainer/devcontainer.json" "$PIN_SANDBOX/.devcontainer/"
}

run_pin_gate() {
  run env -C "$PIN_SANDBOX" node scripts/ci/check-version-pins.mjs
}

@test "host-stack.sh start builds the static export and serves it without Docker" {
  create_curl_stub
  create_generic_stub next
  create_generic_stub next-export-optimize-images
  create_generic_stub serve

  # A node stub that records the API base URL: the swagger patch step must run
  # against the container's value, not whatever the shell already exports.
  cat > "$STUB_BIN_DIR/node" <<'STUB'
#!/usr/bin/env bash
printf 'node NEXT_PUBLIC_API_BASE_URL=%s %s\n' "${NEXT_PUBLIC_API_BASE_URL:-unset}" "$*" >> "${COMMAND_LOG:?}"
exit 0
STUB
  chmod +x "$STUB_BIN_DIR/node"

  run_host_stack start
  [ "$status" -eq 0 ]

  assert_log_contains 'scripts/generateLocalization.mjs'
  # `make` exports .env.production, so the ambient NEXT_PUBLIC_API_BASE_URL here is
  # the real production API — exactly the value that must not reach servers[0].url.
  assert_log_contains 'node NEXT_PUBLIC_API_BASE_URL=http://mockoon:8080 scripts/patchSwaggerServer.mjs'
  assert_log_contains 'next build --webpack'
  assert_log_contains 'next-export-optimize-images'
  assert_log_contains_eventually 'serve -l 3001 out'

  # Same static site the prod container serves — and nothing else.
  run grep -F 'docker' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "host-stack.sh stop is idempotent and an unknown subcommand fails with usage" {
  create_curl_stub

  run_host_stack stop
  [ "$status" -eq 0 ]

  run_host_stack stop
  [ "$status" -eq 0 ]

  run_host_stack browse-the-web
  [ "$status" -ne 0 ]
  assert_output_contains 'Usage:'
}

@test "check-version-pins.mjs passes on the committed tree and fails on any single pin drift" {
  setup_pin_sandbox

  run_pin_gate
  [ "$status" -eq 0 ]

  local label file mutation

  while IFS='|' read -r label file mutation; do
    [ -n "$label" ] || continue

    (cd "$PIN_SANDBOX" && eval "$mutation")

    run_pin_gate
    if [ "$status" -eq 0 ]; then
      echo "expected the pin gate to fail after drifting: $label" >&2
      echo "--- gate output ---" >&2
      printf '%s\n' "${output-}" >&2
      return 1
    fi

    # A mutation that ADDS a file (a rogue workflow) has no committed original to
    # copy back, so restoring means deleting it.
    if [ -e "$PROJECT_ROOT/$file" ]; then
      cp "$PROJECT_ROOT/$file" "$PIN_SANDBOX/$file"
    else
      rm -f "$PIN_SANDBOX/$file"
    fi
    run_pin_gate
    [ "$status" -eq 0 ]
  done <<'EOF'
node version|.nvmrc|printf '99.0.0\n' > .nvmrc
node image|Apollo.Dockerfile|sed -i 's#node:[0-9.]*-alpine#node:99.0.0-alpine#' Apollo.Dockerfile
alpine tag|Mockoon.Dockerfile|sed -i 's#-alpine[0-9.]*#-alpine9.99#' Mockoon.Dockerfile
bun version|.bun-version|printf '99.0.0\n' > .bun-version
bun install in a Dockerfile|MemoryLeak.Dockerfile|sed -i 's#bun@[0-9.]*#bun@99.0.0#' MemoryLeak.Dockerfile
bun install in the DIND recipe|Makefile|sed -i 's#npm install -g bun@[0-9.]*#npm install -g bun@99.0.0#' Makefile
playwright image|Playwright.Dockerfile|sed -i 's#playwright:v[0-9.]*-jammy#playwright:v99.0.0-jammy#' Playwright.Dockerfile
literal node-version in a workflow|.github/workflows/unit-testing.yml|sed -i "s#node-version-file:.*#node-version: '99.0.0'#" .github/workflows/unit-testing.yml
setup-node step with no version file|.github/workflows/unit-testing.yml|sed -i "/node-version-file:/d" .github/workflows/unit-testing.yml
literal node-version in a .yaml workflow|.github/workflows/rogue.yaml|printf 'jobs:\n  a:\n    steps:\n      - uses: actions/setup-node@abc\n        with:\n          node-version: 20\n' > .github/workflows/rogue.yaml
packageManager version|package.json|sed -i 's#"bun@[0-9.]*"#"bun@99.0.0"#' package.json
engines.node range|package.json|sed -i 's#"node": "\^[0-9]*"#"node": "^99"#' package.json
engines.bun floor|package.json|sed -i 's#">=[0-9.]*"#">=99.0.0"#' package.json
playwright devDependency|package.json|sed -i 's#"@playwright/test": "[0-9.]*"#"@playwright/test": "99.0.0"#' package.json
playwright runtime devDependency|package.json|sed -i 's#"playwright": "[0-9.]*"#"playwright": "99.0.0"#' package.json
unpinned global bun install|Dockerfile|sed -i 's#npm install -g bun@[0-9.]*#npm install -g bun#' Dockerfile
devcontainer build target|.devcontainer/devcontainer.json|sed -i 's#"target": "base"#"target": "production"#' .devcontainer/devcontainer.json
devcontainer source Dockerfile|.devcontainer/devcontainer.json|sed -i 's#"dockerfile": "../Dockerfile"#"dockerfile": "../Playwright.Dockerfile"#' .devcontainer/devcontainer.json
devcontainer host-mode flag|.devcontainer/devcontainer.json|sed -i 's#"CI": "1"#"CI": "0"#' .devcontainer/devcontainer.json
devcontainer embeds a version|.devcontainer/devcontainer.json|sed -i 's#"name": "VilnaCRM website"#"name": "VilnaCRM website 1.2.3"#' .devcontainer/devcontainer.json
EOF
}

@test "check-version-pins.mjs requires the committed devcontainer and rejects a fifth pin" {
  setup_pin_sandbox

  # The baseline is the real .devcontainer/devcontainer.json, not a stand-in, so a
  # regression in the committed file fails here.
  run_pin_gate
  [ "$status" -eq 0 ]

  # Absence is a failure, not a skip: an optional check stops holding the moment
  # someone deletes or renames the file it guards.
  rm "$PIN_SANDBOX/.devcontainer/devcontainer.json"
  run_pin_gate
  [ "$status" -ne 0 ]
  [[ "${output-}" == *"is missing"* ]]

  cp "$PROJECT_ROOT/.devcontainer/devcontainer.json" "$PIN_SANDBOX/.devcontainer/"
  run_pin_gate
  [ "$status" -eq 0 ]

  # A version that is not the current one must still be rejected: matching only
  # today's values would wave through a devcontainer pinned to a different Node.
  sed -i 's#"remoteEnv": {#"remoteEnv": { "BUN_VERSION": "9.9.9",#' \
    "$PIN_SANDBOX/.devcontainer/devcontainer.json"
  run_pin_gate
  [ "$status" -ne 0 ]
}
