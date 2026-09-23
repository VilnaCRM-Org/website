#!/usr/bin/env bats
#
# Coverage for `make lint-actionlint` and scripts/ci/ensure-actionlint.sh (issue
# #322). The binaries are stubbed, so these pin the CONTRACT: the pinned
# actionlint runs with the pinned shellcheck, a current install is reused without
# touching the network, a stale one is re-fetched and must pass its digest before
# anything lints, and the gate's exit status reaches make. The workflow wiring is
# read with js-yaml, never grepped.

load './test_helper.bash'

setup() {
  setup_makefile_test_env
}

# $1: the version the actionlint stub reports; $2: its exit status; $3: the
# version the shellcheck stub reports.
seed_binaries() {
  mkdir -p "$MAKEFILE_SANDBOX/bin"
  cat >"$MAKEFILE_SANDBOX/bin/actionlint" <<EOF
#!/usr/bin/env bash
if [ "\$1" = '-version' ]; then
  printf '%s\ninstalled by downloading from release page\n' '${1:-1.7.12}'
  exit 0
fi
printf 'actionlint %s\n' "\$*" >> "\${COMMAND_LOG:?}"
exit ${2:-0}
EOF
  cat >"$MAKEFILE_SANDBOX/bin/shellcheck" <<EOF
#!/usr/bin/env bash
if [ "\$1" = '--version' ]; then
  printf 'ShellCheck - shell script analysis tool\nversion: %s\n' '${3:-0.11.0}'
  exit 0
fi
printf 'shellcheck %s\n' "\$*" >> "\${COMMAND_LOG:?}"
exit 0
EOF
  chmod +x "$MAKEFILE_SANDBOX/bin/actionlint" "$MAKEFILE_SANDBOX/bin/shellcheck"
}

# A curl double that really writes the `-o` file, with bytes no pinned digest
# matches, so the digest check itself is what must stop the install.
create_tampering_curl_stub() {
  cat >"$STUB_BIN_DIR/curl" <<'EOF'
#!/usr/bin/env bash
printf 'curl %s\n' "$*" >> "${COMMAND_LOG:?}"
out=''
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-o' ]; then
    out="$2"
  fi
  shift
done
printf 'not the release asset\n' > "$out"
EOF
  chmod +x "$STUB_BIN_DIR/curl"
}

@test "lint-actionlint lints with the pinned actionlint and the pinned shellcheck" {
  seed_binaries 1.7.12 0

  run_make_target lint-actionlint
  [ "$status" -eq 0 ]
  assert_log_contains 'actionlint -shellcheck=./bin/shellcheck -pyflakes= -color'

  run grep -F 'curl ' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "lint-actionlint fails when actionlint reports findings" {
  seed_binaries 1.7.12 1

  run_make_target lint-actionlint
  [ "$status" -ne 0 ]
  assert_log_contains 'actionlint -shellcheck=./bin/shellcheck'
}

@test "a stale actionlint is re-fetched and a digest mismatch aborts before any lint" {
  seed_binaries 1.7.11 0
  create_tampering_curl_stub

  run_make_target lint-actionlint
  [ "$status" -ne 0 ]
  assert_log_contains 'curl -fsSL'
  assert_log_contains 'releases/download/v1.7.12/actionlint_1.7.12_'

  run grep -F 'actionlint -shellcheck' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "a stale shellcheck is re-fetched and a digest mismatch aborts before any lint" {
  seed_binaries 1.7.12 0 0.10.0
  create_tampering_curl_stub

  run_make_target lint-actionlint
  [ "$status" -ne 0 ]
  assert_log_contains 'koalaman/shellcheck/releases/download/v0.11.0/shellcheck-v0.11.0.'

  run grep -F 'rhysd/actionlint/releases' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
  run grep -F 'actionlint -shellcheck' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "a lookalike version such as 1.7.120 does not satisfy the 1.7.12 pin" {
  seed_binaries 1.7.120 0
  create_tampering_curl_stub

  run_make_target lint-actionlint
  [ "$status" -ne 0 ]
  assert_log_contains 'releases/download/v1.7.12/'
}

@test "the actionlint job runs make lint-actionlint on every pull request" {
  # setup_makefile_test_env stubs `node`; the real one must read the workflow, or
  # the stub's exit 0 would pass this case vacuously.
  local real_path="${PATH#"$STUB_BIN_DIR":}"
  cd "$PROJECT_ROOT"

  run env PATH="$real_path" node --input-type=module -e "
    import fs from 'node:fs';
    import yaml from 'js-yaml';
    const doc = yaml.load(fs.readFileSync('.github/workflows/workflow-security.yml', 'utf8'));
    const pr = doc.on.pull_request ?? {};
    const job = doc.jobs.actionlint;
    const runs = job.steps.map((step) => step.run).filter(Boolean);
    const ok =
      !('paths' in pr) && !('paths-ignore' in pr) && !('if' in job) &&
      runs.some((body) => body.trim() === 'make lint-actionlint');
    process.exit(ok ? 0 : 1);
  "
  [ "$status" -eq 0 ]

  run env PATH="$real_path" bash -c "node scripts/ci/pr-check-names.mjs | jq -e '[.[] | select(.name == \"actionlint\" and .workflow == \"workflow-security.yml\")] | length == 1'"
  [ "$status" -eq 0 ]
}
