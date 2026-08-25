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
  # A serve that stays up: `start` only reports success while the pid it recorded
  # is still running its own invocation, so a stub that exits immediately would
  # (correctly) fail the readiness wait.
  create_long_running_serve_stub

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

  run_host_stack stop
}

# A curl stub that refuses the first probe and answers every one after it. The
# refusal forces `start` through a full wait iteration, so the immediately
# exiting `serve` below is reliably dead by the time the second probe answers —
# without it the test would race the stub's own exit.
create_late_answering_curl_stub() {
  cat > "$STUB_BIN_DIR/curl" <<'STUB'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"

attempts="${COMMAND_LOG:?}.curl-attempts"
count=$(( $(cat "$attempts" 2>/dev/null || printf '0') + 1 ))
printf '%s\n' "$count" > "$attempts"

[ "$count" -gt 1 ]
STUB

  chmod +x "$STUB_BIN_DIR/curl"
}

# The port is the Docker prod stack's own 3001, so "something answers it" is not
# evidence that OUR server came up. When a foreign listener already holds it,
# `serve` dies on EADDRINUSE while the probe stays green — and `start` used to
# print "✅ Host prod stack is serving …" and hand the browser suites whatever
# `out/` that other process was publishing.
@test "host-stack.sh start fails when the port is answered by a foreign process" {
  create_late_answering_curl_stub
  create_generic_stub next
  create_generic_stub next-export-optimize-images
  create_generic_stub node
  # Stands in for a `serve` that exits at once, the way it does on EADDRINUSE.
  create_generic_stub serve

  run_host_stack start
  [ "$status" -ne 0 ]
  assert_output_contains 'no longer running'
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

host_stack_pid_gone() {
  local pid="$1"

  # `kill` is asynchronous, so the process may outlive the command by a beat.
  local _
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    kill -0 "$pid" 2>/dev/null || return 0
    sleep 0.2
  done

  return 1
}

@test "host-stack.sh stop terminates the serve that start launched" {
  create_curl_stub
  create_generic_stub next
  create_generic_stub next-export-optimize-images
  create_generic_stub node
  create_long_running_serve_stub

  run_host_stack start
  [ "$status" -eq 0 ]

  local state_dir="$SCRIPT_SANDBOX/.host-stack"
  local pid
  pid="$(cat "$state_dir/serve.pid")"
  [ -n "$pid" ]
  kill -0 "$pid"

  run_host_stack stop
  [ "$status" -eq 0 ]
  # The identity check recognised its own server, so nothing was skipped.
  [[ "${output-}" != *"not the serve this stack started"* ]]

  if ! host_stack_pid_gone "$pid"; then
    kill "$pid" 2>/dev/null || true
    echo "expected stop to terminate the serve it started (pid $pid)" >&2
    return 1
  fi

  [ ! -e "$state_dir/serve.pid" ]
  [ ! -e "$state_dir/serve.cmd" ]
}

# The identity has to come from `ps`, which exists on macOS and the BSDs, and not
# from /proc/<pid>/cmdline, which does not: on a non-Linux host that read
# returned nothing, every check answered "not ours", and `stop` silently leaked
# the server it was asked to stop. Both implementations work on Linux, so a `ps`
# stub is the only way to tell them apart here — a `sleep` whose argument vector
# /proc would never report as the recorded serve.
@test "host-stack.sh stop takes the process identity from ps, not from /proc" {
  create_curl_stub

  local state_dir="$SCRIPT_SANDBOX/.host-stack"
  mkdir -p "$state_dir"

  sleep 20 3>&- >/dev/null 2>&1 &
  local pid=$!

  local expected="$STUB_BIN_DIR/serve -l 3001 out"
  printf '%s\n' "$pid" > "$state_dir/serve.pid"
  printf '%s\n' "$expected" > "$state_dir/serve.cmd"

  # The `node ` prefix is what a `#!/usr/bin/env node` shebang really puts in the
  # argument vector, so this covers the interpreter form too.
  cat > "$STUB_BIN_DIR/ps" <<STUB
#!/usr/bin/env bash
printf 'node %s\n' '$expected'
STUB
  chmod +x "$STUB_BIN_DIR/ps"

  run_host_stack stop
  [ "$status" -eq 0 ]
  [[ "${output-}" != *"not the serve this stack started"* ]]

  if ! host_stack_pid_gone "$pid"; then
    kill "$pid" 2>/dev/null || true
    echo 'stop ignored ps and fell back to a Linux-only /proc read' >&2
    return 1
  fi

  [ ! -e "$state_dir/serve.pid" ]
  [ ! -e "$state_dir/serve.cmd" ]
}

# `start` calls `stop` on every run, so a pidfile left by a reboot or a `kill -9`
# is routinely handed a pid the kernel has since recycled onto somebody else's
# process. Signalling it would kill a bystander; the only safe answer is to
# signal nothing and drop the file.
@test "host-stack.sh stop refuses to signal a recycled pid and drops the stale pidfile" {
  create_curl_stub

  local state_dir="$SCRIPT_SANDBOX/.host-stack"
  mkdir -p "$state_dir"

  # A live process that is emphatically not this stack's server. fd 3 is closed
  # so the background job never holds Bats' output stream open.
  sleep 20 3>&- >/dev/null 2>&1 &
  local bystander=$!

  printf '%s\n' "$bystander" > "$state_dir/serve.pid"
  printf '%s\n' "$STUB_BIN_DIR/serve -l 3001 out" > "$state_dir/serve.cmd"

  run_host_stack stop
  [ "$status" -eq 0 ]
  assert_output_contains 'not the serve this stack started'

  # Untouched: the whole point of failing safe.
  if ! kill -0 "$bystander" 2>/dev/null; then
    echo "stop killed pid $bystander, whose command never matched the recorded serve" >&2
    return 1
  fi
  kill "$bystander" 2>/dev/null || true

  [ ! -e "$state_dir/serve.pid" ]
  [ ! -e "$state_dir/serve.cmd" ]
}

# The near-miss the substring match used to wave through: a `server` binary on
# the same port shares every character the old `*serve*<port>*` pattern looked at.
@test "host-stack.sh stop refuses a near-miss command and a pidfile with no recorded command" {
  create_curl_stub

  local state_dir="$SCRIPT_SANDBOX/.host-stack"
  mkdir -p "$state_dir"

  cat > "$STUB_BIN_DIR/server" <<'STUB'
#!/usr/bin/env bash
sleep 20
STUB
  chmod +x "$STUB_BIN_DIR/server"

  "$STUB_BIN_DIR/server" -l 3001 out 3>&- >/dev/null 2>&1 &
  local near_miss=$!

  printf '%s\n' "$near_miss" > "$state_dir/serve.pid"
  printf '%s\n' "$STUB_BIN_DIR/serve -l 3001 out" > "$state_dir/serve.cmd"

  run_host_stack stop
  [ "$status" -eq 0 ]
  assert_output_contains 'not the serve this stack started'

  if ! kill -0 "$near_miss" 2>/dev/null; then
    echo "stop killed the 'server' process that merely resembles 'serve'" >&2
    return 1
  fi

  # An unprovable identity is not an identity: a pidfile with no companion
  # command file authorises nothing either.
  printf '%s\n' "$near_miss" > "$state_dir/serve.pid"
  rm -f "$state_dir/serve.cmd"

  run_host_stack stop
  [ "$status" -eq 0 ]
  assert_output_contains '<no recorded start command>'

  if ! kill -0 "$near_miss" 2>/dev/null; then
    echo "stop killed a pid it had no recorded start command for" >&2
    return 1
  fi
  kill "$near_miss" 2>/dev/null || true

  [ ! -e "$state_dir/serve.pid" ]
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
node image behind a platform flag|Dockerfile|sed -i 's#^FROM .* AS production#FROM --platform=linux/amd64 node:99.0.0-alpine3.23 AS production#' Dockerfile
node image on a lowercase from|Apollo.Dockerfile|sed -i 's#^FROM #from #; s#node:[0-9.]*-alpine#node:99.0.0-alpine#' Apollo.Dockerfile
playwright image behind a platform flag|Playwright.Dockerfile|sed -i 's#^FROM #FROM --platform=linux/amd64 #; s#playwright:v[0-9.]*-jammy#playwright:v99.0.0-jammy#' Playwright.Dockerfile
EOF
}

# `FROM --platform=$BUILDPLATFORM …` and a lowercase `from` are both legal
# Dockerfile syntax, and a commented-out FROM is not a pin at all. A matcher that
# reads any of the three wrongly is fail-open on a multi-stage file: the drifted
# stage stops being seen while a sibling keeps the "declares no base image" check
# quiet — or, in the other direction, it invents a drift from a comment.
@test "check-version-pins.mjs reads FROM instructions, not flags, case, or comments" {
  setup_pin_sandbox

  run_pin_gate
  [ "$status" -eq 0 ]

  # Legal spellings of the very images the gate already accepts.
  (cd "$PIN_SANDBOX" && sed -i 's#^FROM #FROM --platform=linux/amd64 #' Playwright.Dockerfile)
  (cd "$PIN_SANDBOX" && sed -i 's#^FROM #from #' Mockoon.Dockerfile)
  run_pin_gate
  if [ "$status" -ne 0 ]; then
    echo 'the pin gate stopped recognising a flagged or lowercase FROM' >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi

  # A FROM inside a comment names no image the build ever pulls.
  (cd "$PIN_SANDBOX" && sed -i '1i # FROM node:99.0.0-alpine3.23' MemoryLeak.Dockerfile)
  run_pin_gate
  if [ "$status" -ne 0 ]; then
    echo 'the pin gate read a commented-out FROM as a pin' >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi

  # An unrelated image whose name merely ends in "node" is not a Node base image.
  (cd "$PIN_SANDBOX" && sed -i '1i FROM mynode:99.0.0-alpine3.23 AS unrelated' Apollo.Dockerfile)
  run_pin_gate
  if [ "$status" -ne 0 ]; then
    echo 'the pin gate read "mynode:" as the node image' >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi
}

# Every other check in this section is gated on `isKeyLine`, but the
# node-version-file test used to run an unanchored regex over the step's raw text.
# A comment quoting the canonical snippet, a longer path that starts with `.nvmrc`,
# or a similarly suffixed key each satisfied it while the step stayed unpinned.
@test "check-version-pins.mjs requires a real node-version-file key valued exactly .nvmrc" {
  setup_pin_sandbox

  local probe="$PIN_SANDBOX/.github/workflows/probe.yml"

  write_setup_node_probe() {
    cat > "$probe" <<YAML
name: probe
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
$1
YAML
  }

  write_setup_node_probe "          node-version-file: '.nvmrc'"
  run_pin_gate
  if [ "$status" -ne 0 ]; then
    echo 'the pin gate rejected the canonical node-version-file step' >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi

  local hole
  for hole in \
    '          # node-version-file: .nvmrc'$'\n''          cache: bun' \
    '          node-version-file: .nvmrc.example' \
    '          legacy-node-version-file: .nvmrc'; do
    write_setup_node_probe "$hole"
    run_pin_gate
    if [ "$status" -eq 0 ]; then
      echo "an unpinned setup-node step passed the gate: $hole" >&2
      return 1
    fi
    assert_output_contains 'without node-version-file'
  done

  rm -f "$probe"
  run_pin_gate
  [ "$status" -eq 0 ]
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

# A gate that cannot tell a step from a sentence has no stable definition of
# "pinned": the only way to clear a finding raised against a comment or a shell
# heredoc is to delete the documentation, so the gate ends up teaching people to
# stop writing it down.
@test "check-version-pins.mjs reads setup-node keys, not the prose that quotes them" {
  setup_pin_sandbox

  run_pin_gate
  [ "$status" -eq 0 ]

  # Two mentions, no step: the canonical snippet quoted in a comment, and the
  # same fragment echoed out of a `run: |` block.
  cat > "$PIN_SANDBOX/.github/workflows/prose.yml" <<'YAML'
name: prose
on: push
jobs:
  docs:
    runs-on: ubuntu-latest
    steps:
      # Node jobs must read the version from .nvmrc, never inline it:
      #   - uses: actions/setup-node@v6
      #     with:
      #       node-version: '24.18.0'
      - name: Explain the pin
        run: |
          uses: actions/setup-node@v6
          node-version: 24.18.0
          echo 'pin Node through .nvmrc'
YAML

  run_pin_gate
  if [ "$status" -ne 0 ]; then
    echo 'the pin gate invented a failure from a comment / run: block' >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi

  # Same file, one real step appended: the relaxation must not have opened a hole
  # for an actual unpinned setup-node, nor for an actual literal node-version.
  cat >> "$PIN_SANDBOX/.github/workflows/prose.yml" <<'YAML'
      - uses: actions/setup-node@v6
        with:
          node-version: '24.18.0'
YAML

  run_pin_gate
  [ "$status" -ne 0 ]
  assert_output_contains 'without node-version-file'
  assert_output_contains 'pins a literal node-version'

  rm -f "$PIN_SANDBOX/.github/workflows/prose.yml"
  run_pin_gate
  [ "$status" -eq 0 ]
}
