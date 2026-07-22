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
