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

# A `serve` stub that stays up. `host-stack.sh start` only reports success while
# the pid it recorded is still running its own invocation — a stub that exits at
# once is (correctly) read as "the port is answered by somebody else" — and `stop`
# needs a live process to identify. `sleep` is bounded rather than infinite: a test
# that fails before killing it must not leave a process behind.
create_long_running_serve_stub() {
  cat > "$STUB_BIN_DIR/serve" <<'EOF'
#!/usr/bin/env bash
printf 'serve %s\n' "$*" >> "${COMMAND_LOG:?}"
sleep 20
EOF

  chmod +x "$STUB_BIN_DIR/serve"
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

# Lets a test stand in for a machine with no running daemon, which is the one
# state the Makefile turns into a HOST_STACK=1 hint rather than a raw error.
if [ "$1" = "info" ]; then
  if [ "${FAKE_DOCKER_DAEMON_DOWN:-0}" = "1" ]; then
    printf 'Cannot connect to the Docker daemon.\n' >&2
    exit 1
  fi
  exit 0
fi

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
    # `compose config` resolves a project (scripts/ci/ecr-mirror.sh reads it);
    # FAKE_COMPOSE_CONFIG names the JSON a test wants it to resolve to.
    if [ "$arg" = "config" ] && [ -n "${FAKE_COMPOSE_CONFIG:-}" ]; then
      cat "$FAKE_COMPOSE_CONFIG"
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
  create_long_running_serve_stub
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
  # lint-placeholders (issue #327) is in CI_LINT_TARGETS and is plain bash, so
  # unlike the node and npm-tool gates it cannot be stubbed away: `make ci-lint`
  # in this sandbox runs the real scan, and the gate fails closed on a scan
  # root it cannot see. Seed its default roots -- empty source directories plus
  # the small committed files -- so it certifies a clean tree here; its own
  # behaviour over a seeded tree is covered by tests/bats/check_placeholders.bats.
  mkdir -p "$MAKEFILE_SANDBOX/src" "$MAKEFILE_SANDBOX/pages" "$MAKEFILE_SANDBOX/public"
  cp "$PROJECT_ROOT/.env.example" "$PROJECT_ROOT/.env.production" "$PROJECT_ROOT/README.md" \
    "$MAKEFILE_SANDBOX/"
  # build-out (issue #325) reads the version straight out of package.json with a real
  # `jq`, which is not in the stub list above -- without this copy that read fails,
  # since nothing else here provisions package.json.
  cp "$PROJECT_ROOT/package.json" "$MAKEFILE_SANDBOX/"
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

# --- Git Database API helpers (issues #515, #517) ---------------------------------

# A `gh api` double for scripts/ci/sign-release-commit.sh that implements the three
# Git Database endpoints the script calls on top of a real bare repository, so the
# objects it reports are objects `git fetch` can then retrieve. Blob and tree SHAs
# are therefore computed by git itself, never echoed back from the request; the
# commit it writes carries a placeholder `gpgsig` header the way GitHub's signed
# commits do. Every request body is copied to $GH_FAKE_REQUESTS/<n>-<endpoint>.json.
#   GH_FAKE_REMOTE    the bare repository standing in for GitHub (required)
#   GH_FAKE_FAIL_ON   blobs|trees|commits: answer that endpoint with an HTTP 500
#   GH_FAKE_BLOB_SHA  report this SHA from git/blobs instead of the real one
#   GH_FAKE_TREE_SHA  report this SHA from git/trees instead of the real one
#   GH_FAKE_VERIFIED  false: report the created commit as not verified
#   GH_FAKE_UNSIGNED  1: write the commit without a gpgsig header (still "verified")
#   GH_FAKE_TAMPER_PAYLOAD  1: return a verification.payload that differs from the commit
create_git_data_api_gh_stub() {
  export GH_FAKE_REQUESTS="$BATS_TEST_TMPDIR/gh-requests"
  mkdir -p "$GH_FAKE_REQUESTS"

  cat >"$STUB_BIN_DIR/gh" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
printf 'gh %s\n' "$*" >>"${COMMAND_LOG:?}"

endpoint=""
input=""
while [ "$#" -gt 0 ]; do
  case "$1" in
    repos/*/git/blobs | repos/*/git/trees | repos/*/git/commits) endpoint="${1##*/}" ;;
    --input)
      shift
      input="$1"
      ;;
  esac
  shift
done

[ -n "$endpoint" ] && [ -f "$input" ] || { echo "gh stub: unexpected call" >&2; exit 64; }

count="$(find "${GH_FAKE_REQUESTS:?}" -type f | wc -l)"
cp "$input" "$GH_FAKE_REQUESTS/$((count + 1))-$endpoint.json"

if [ "${GH_FAKE_FAIL_ON:-}" = "$endpoint" ]; then
  echo 'gh: Server Error (HTTP 500)' >&2
  exit 1
fi

remote=(git --git-dir="${GH_FAKE_REMOTE:?}")

case "$endpoint" in
  blobs)
    sha="$(jq -r '.content' "$input" | base64 -d | "${remote[@]}" hash-object -w --stdin)"
    jq -n --arg sha "${GH_FAKE_BLOB_SHA:-$sha}" '{sha: $sha}'
    ;;
  trees)
    export GIT_INDEX_FILE="$GH_FAKE_REQUESTS/index"
    rm -f "$GIT_INDEX_FILE"
    "${remote[@]}" read-tree "$(jq -r '.base_tree' "$input")"
    while IFS= read -r -d '' mode && IFS= read -r -d '' sha && IFS= read -r -d '' path; do
      "${remote[@]}" update-index --add --cacheinfo "$mode,$sha,$path"
    done < <(jq -j '.tree[] | .mode, "\u0000", .sha, "\u0000", .path, "\u0000"' "$input")
    sha="$("${remote[@]}" write-tree)"
    rm -f "$GIT_INDEX_FILE"
    jq -n --arg sha "${GH_FAKE_TREE_SHA:-$sha}" '{sha: $sha}'
    ;;
  commits)
    tree="$(jq -r '.tree' "$input")"
    {
      printf 'tree %s\n' "$tree"
      jq -r '.parents[] | "parent \(.)"' "$input"
      printf 'author release[bot] <1+release[bot]@users.noreply.github.com> 1790000000 +0000\n'
      printf 'committer GitHub <noreply@github.com> 1790000000 +0000\n'
    } >"$GH_FAKE_REQUESTS/commit-headers"
    {
      cat "$GH_FAKE_REQUESTS/commit-headers"
      if [ "${GH_FAKE_UNSIGNED:-0}" != 1 ]; then
        printf 'gpgsig -----BEGIN PGP SIGNATURE-----\n \n stub\n -----END PGP SIGNATURE-----\n'
      fi
      printf '\n'
      jq -j '.message' "$input"
    } >"$GH_FAKE_REQUESTS/commit-object"
    {
      cat "$GH_FAKE_REQUESTS/commit-headers"
      printf '\n'
      jq -j '.message' "$input"
      if [ "${GH_FAKE_TAMPER_PAYLOAD:-0}" = 1 ]; then printf 'tampered\n'; fi
    } >"$GH_FAKE_REQUESTS/commit-payload"
    sha="$("${remote[@]}" hash-object -t commit -w "$GH_FAKE_REQUESTS/commit-object")"
    verified=true
    reason=valid
    if [ "${GH_FAKE_VERIFIED:-true}" = false ]; then
      verified=false
      reason=unsigned
    fi
    jq -n --arg sha "$sha" --arg tree "$tree" --argjson verified "$verified" \
      --arg reason "$reason" --slurpfile req "$input" \
      --rawfile payload "$GH_FAKE_REQUESTS/commit-payload" \
      --arg signature $'-----BEGIN PGP SIGNATURE-----\n\nstub\n-----END PGP SIGNATURE-----\n' \
      '{sha: $sha, tree: {sha: $tree}, parents: [$req[0].parents[] | {sha: .}],
        verification: {verified: $verified, reason: $reason,
          payload: $payload, signature: $signature}}'
    ;;
esac
EOF

  chmod +x "$STUB_BIN_DIR/gh"
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

# A bare `[ "$status" -eq 0 ]` discards `$output`, so a failure cannot say which
# stage of the command under test gave up (issue #492).
assert_success() {
  if [ "${status-}" != 0 ]; then
    echo "Expected exit status 0, got ${status-unset}" >&2
    echo "--- output ---" >&2
    printf '%s\n' "${output-}" >&2
    return 1
  fi
}

# The negative form. A gate that must stay QUIET about something needs an
# assertion for it, or "no warning was emitted" is indistinguishable from "the
# assertion was never reached".
refute_output_contains() {
  local unexpected="$1"
  local actual_output="${output-}"

  if [[ "$actual_output" == *"$unexpected"* ]]; then
    echo "Expected output NOT to contain: $unexpected" >&2
    echo "--- output ---" >&2
    printf '%s\n' "$actual_output" >&2
    return 1
  fi
}

# The host stack starts `serve` in the background, so its stub can append to the
# command log a beat after the command under test has already returned.
assert_log_contains_eventually() {
  local expected="$1"

  # `_` rather than a named counter: the loop only bounds the number of retries,
  # nothing reads the value.
  for _ in 1 2 3 4 5; do
    if grep -F -- "$expected" "$COMMAND_LOG" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done

  assert_log_contains "$expected"
}
