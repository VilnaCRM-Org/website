#!/usr/bin/env bash

PROJECT_ROOT="$(cd "$(dirname "${BATS_TEST_FILENAME:-$0}")/../.." >/dev/null 2>&1 && pwd)"

setup_stub_dir() {
  export STUB_BIN_DIR="$BATS_TEST_TMPDIR/bin"
  export COMMAND_LOG="$BATS_TEST_TMPDIR/commands.log"

  mkdir -p "$STUB_BIN_DIR"
  : > "$COMMAND_LOG"

  export PATH="$STUB_BIN_DIR:$PATH"
}

reset_command_log() {
  : > "$COMMAND_LOG"
}

create_generic_stub() {
  local name="$1"

  cat > "$STUB_BIN_DIR/$name" <<'EOF'
#!/usr/bin/env bash
printf '%s %s\n' "$(basename "$0")" "$*" >> "${COMMAND_LOG:?}"
exit 0
EOF

  chmod +x "$STUB_BIN_DIR/$name"
}

create_curl_stub() {
  cat > "$STUB_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
exit 0
EOF

  chmod +x "$STUB_BIN_DIR/curl"
}

create_docker_stub() {
  cat > "$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"

if [ "$1" = "network" ] && [ "$2" = "ls" ]; then
  if [ "${FAKE_DOCKER_NETWORK_EXISTS:-0}" = "1" ]; then
    printf '%s\n' "${FAKE_DOCKER_NETWORK_NAME:-website-network}"
  fi
  exit 0
fi

if [ "$1" = "create" ]; then
  printf 'fake-container-id\n'
  exit 0
fi

# ensure-dev's foreign-checkout preflight (check-dev-container-bind.sh) asks for
# the dev container's /app bind source. Answer with the directory make is running
# from -- "bound to THIS checkout", the state every Makefile test assumes. A bare
# `exit 0` here would read as "the container exists with no /app bind", which the
# guard deliberately refuses. Override FAKE_DOCKER_APP_BIND to model a foreign
# checkout, or FAKE_DOCKER_INSPECT_EXIT=1 to model no such container.
if [ "$1" = "inspect" ]; then
  if [ "${FAKE_DOCKER_INSPECT_EXIT:-0}" != "0" ]; then
    exit "${FAKE_DOCKER_INSPECT_EXIT}"
  fi
  printf '%s' "${FAKE_DOCKER_APP_BIND-$PWD}"
  exit 0
fi

if [ "$1" = "compose" ]; then
  for arg in "$@"; do
    if [ "$arg" = "ps" ]; then
      printf 'prod (healthy)\n'
      exit 0
    fi
  done
fi

if [ ! -t 0 ]; then
  cat >/dev/null || true
fi

exit 0
EOF

  chmod +x "$STUB_BIN_DIR/docker"
}

create_make_stub() {
  cat > "$STUB_BIN_DIR/make" <<'EOF'
#!/usr/bin/env bash
printf 'make %s\n' "$*" >> "${COMMAND_LOG:?}"

target=""
for arg in "$@"; do
  case "$arg" in
    -*|*=*)
      ;;
    *)
      target="$arg"
      break
      ;;
  esac
done

if [ -n "${FAKE_MAKE_FAIL_TARGET:-}" ] && [ "$target" = "$FAKE_MAKE_FAIL_TARGET" ]; then
  exit 1
fi

exit 0
EOF

  chmod +x "$STUB_BIN_DIR/make"
}

setup_makefile_test_env() {
  setup_stub_dir

  create_docker_stub
  create_curl_stub
  create_generic_stub npm
  create_generic_stub bun
  create_generic_stub tar
  create_generic_stub next
  create_generic_stub next-export-optimize-images
  create_generic_stub eslint
  create_generic_stub tsc
  create_generic_stub prettier
  create_generic_stub markdownlint
  create_generic_stub storybook
  create_generic_stub jest
  create_generic_stub serve
  create_generic_stub playwright
  create_generic_stub lhci
  create_generic_stub node

  export MAKEFILE_SANDBOX="$BATS_TEST_TMPDIR/makefile-sandbox"
  mkdir -p "$MAKEFILE_SANDBOX"
  cp "$PROJECT_ROOT/Makefile" "$MAKEFILE_SANDBOX/Makefile"
  cp "$PROJECT_ROOT/.env" "$MAKEFILE_SANDBOX/.env"
  # CI orchestration targets (ci-lint, ci-test, pr-comments) shell out to
  # repository scripts; copy them so recursive make runs resolve their paths.
  cp -R "$PROJECT_ROOT/scripts" "$MAKEFILE_SANDBOX/scripts"
  # lint-node-version reads the repository's Node version sources directly rather
  # than through a stubbed binary, so the sandbox needs them too. Copying the real
  # files keeps the sandbox agreeing with the repository by construction; the
  # drift cases are covered against fixtures in node_version_sources.bats.
  cp "$PROJECT_ROOT/.nvmrc" "$MAKEFILE_SANDBOX/.nvmrc"
  cp "$PROJECT_ROOT/package.json" "$MAKEFILE_SANDBOX/package.json"
  cp "$PROJECT_ROOT"/*.Dockerfile "$PROJECT_ROOT/Dockerfile" "$MAKEFILE_SANDBOX/"
  mkdir -p "$MAKEFILE_SANDBOX/.github/workflows"
  cp -R "$PROJECT_ROOT/.github/workflows/." "$MAKEFILE_SANDBOX/.github/workflows/"
}

setup_ci_script_test_env() {
  setup_stub_dir

  create_docker_stub
  create_make_stub
  create_generic_stub tar

  export SCRIPT_SANDBOX="$BATS_TEST_TMPDIR/script-sandbox"
  mkdir -p "$SCRIPT_SANDBOX"
  cp "$PROJECT_ROOT/common-healthchecks.yml" "$SCRIPT_SANDBOX/common-healthchecks.yml"
}

run_make_target() {
  local target="$1"
  shift

  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    make -C "$MAKEFILE_SANDBOX" "$target" BIN_DIR="$STUB_BIN_DIR" "$@"
}

run_ci_script() {
  local script_path="$1"
  shift

  run env \
    -C "$SCRIPT_SANDBOX" \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    "$script_path" "$@"
}

# --- Code-scanning gate helpers (issue #383) ----------------------------------

# A `gh api` double for scripts/ci/code-scanning-gate.sh. It replays a fixture
# per endpoint + ref and applies the caller's --jq filter with the REAL jq, so
# the gate's severity predicate is genuinely executed instead of being stubbed
# away. Fixtures are selected explicitly:
#   GH_ANALYSES_FIXTURE  path replayed for code-scanning/analyses
#   GH_ALERTS_FIXTURES   newline-separated "<ref>=<path>" map for
#                        code-scanning/alerts (an unmapped ref replays [])
create_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"

endpoint=""
ref=""
filter="."
while [ "$#" -gt 0 ]; do
  case "$1" in
    *code-scanning/analyses) endpoint="analyses" ;;
    *code-scanning/alerts) endpoint="alerts" ;;
    ref=*) ref="${1#ref=}" ;;
    --jq)
      shift
      filter="${1:-.}"
      ;;
  esac
  shift
done

fixture=""
if [ "$endpoint" = "analyses" ]; then
  fixture="${GH_ANALYSES_FIXTURE:-}"
elif [ "$endpoint" = "alerts" ]; then
  fixture="$(printf '%s\n' "${GH_ALERTS_FIXTURES:-}" |
    awk -F= -v r="$ref" '$1 == r { print substr($0, length($1) + 2); exit }')"
fi

if [ -n "$fixture" ] && [ -f "$fixture" ]; then
  jq -r "$filter" <"$fixture"
else
  printf '[]' | jq -r "$filter"
fi
EOF

  chmod +x "$STUB_BIN_DIR/gh"
}

setup_code_scanning_gate_env() {
  setup_stub_dir
  create_gh_stub

  export CODE_SCANNING_FIXTURES="$PROJECT_ROOT/tests/bats/fixtures/code-scanning"
  export GH_TOKEN=stub-token
  export GH_REPO=VilnaCRM-Org/website
  export DEFAULT_BRANCH=main
  # Bounded poll, collapsed so the suite runs instantly.
  export POLL_ATTEMPTS=2
  export POLL_DELAY=0
  export GITHUB_STEP_SUMMARY="$BATS_TEST_TMPDIR/step-summary.md"
  : >"$GITHUB_STEP_SUMMARY"
  export GH_ANALYSES_FIXTURE="$CODE_SCANNING_FIXTURES/analyses-pr.json"
  export GH_ALERTS_FIXTURES=""
}

run_code_scanning_gate() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    "$@" \
    "$PROJECT_ROOT/scripts/ci/code-scanning-gate.sh"
}

assert_log_contains() {
  local expected="$1"

  if ! grep -F -- "$expected" "$COMMAND_LOG" >/dev/null 2>&1; then
    echo "Expected command log to contain: $expected" >&2
    echo "--- command log ---" >&2
    cat "$COMMAND_LOG" >&2
    return 1
  fi
}

assert_output_contains() {
  local expected="$1"
  local actual_output="${output-}"

  if [[ "$actual_output" != *"$expected"* ]]; then
    echo "Expected output to contain: $expected" >&2
    echo "--- output ---" >&2
    printf '%s\n' "$actual_output" >&2
    return 1
  fi
}
