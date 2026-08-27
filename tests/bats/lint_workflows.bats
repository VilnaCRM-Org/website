#!/usr/bin/env bats
#
# Coverage for scripts/ci/lint-workflows.sh (issue #360) -- the zizmor gate over
# .github/workflows. docker is stubbed, so these pin the CONTRACT the script
# hands the linter (digest-pinned image, thresholds, target, token handling)
# rather than zizmor's own verdict. Getting that contract wrong is silent: a
# dropped `--min-severity`, a tag instead of a digest, or a swallowed exit code
# all leave a green check that audits nothing.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/lint-workflows.sh'

DIGEST_IMAGE='ghcr.io/zizmorcore/zizmor@sha256:8e6b3e4fb74d1aa5d23e83ea369f386c66eced0d1fb944d32cd8b2aac100b00d'

setup() {
  setup_stub_dir
  create_docker_stub

  # The script prefers GH_TOKEN, then GITHUB_TOKEN, then `gh auth token`. Stub
  # `gh` as absent by default so each test states its own token situation.
  export ZIZMOR_IMAGE="$DIGEST_IMAGE"
  unset GH_TOKEN GITHUB_TOKEN || true
}

create_gh_stub() {
  cat >"$STUB_BIN_DIR/gh" <<EOF
#!/usr/bin/env bash
printf 'gh %s\n' "\$*" >> "\${COMMAND_LOG:?}"
printf '%s\n' "${1:-}"
exit ${2:-0}
EOF
  chmod +x "$STUB_BIN_DIR/gh"
}

run_lint_workflows() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    TOKEN_SEEN="${TOKEN_SEEN-}" \
    ZIZMOR_IMAGE="${ZIZMOR_IMAGE-}" \
    ZIZMOR_MIN_SEVERITY="${ZIZMOR_MIN_SEVERITY-}" \
    ZIZMOR_MIN_CONFIDENCE="${ZIZMOR_MIN_CONFIDENCE-}" \
    ZIZMOR_TARGETS="${ZIZMOR_TARGETS-}" \
    GH_TOKEN="${GH_TOKEN-}" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

# A docker stub that records the GH_TOKEN the container would actually receive, so
# a test can prove the token reaches it rather than only proving it is absent from
# argv -- a typo'd `-e GH_TOKENN` would satisfy the absence assertions while
# silently disabling every online audit.
#
# It records the value ONLY when the exact `-e GH_TOKEN` argument pair is present.
# Reading GH_TOKEN straight out of the stub's own environment would be a fail-open:
# lint-workflows.sh `export`s GH_TOKEN before invoking docker, so the stub inherits
# it either way and the assertion would hold even with the flag misspelled or gone.
create_token_recording_docker_stub() {
  export TOKEN_SEEN="$BATS_TEST_TMPDIR/token-seen"
  : >"$TOKEN_SEEN"

  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"
forwarded=false
while [ "$#" -gt 0 ]; do
  if [ "$1" = '-e' ] && [ "${2-}" = 'GH_TOKEN' ]; then
    forwarded=true
    break
  fi
  shift
done
if [ "$forwarded" = true ]; then
  printf '%s' "${GH_TOKEN-}" > "${TOKEN_SEEN:?}"
fi
exit 0
EOF
  chmod +x "$STUB_BIN_DIR/docker"
}

# --- Positive ------------------------------------------------------------------

@test "audits .github/workflows through the digest-pinned zizmor image" {
  export GH_TOKEN='token-from-env'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains "$DIGEST_IMAGE"
  assert_log_contains '.github/workflows/'
}

@test "pins the image by digest, never by a mutable tag" {
  export GH_TOKEN='token-from-env'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains 'zizmor@sha256:'
  # A tag pin would let a repointed tag change what the security gate enforces.
  ! grep -Eq 'zizmor:[0-9]' "$COMMAND_LOG"
}

@test "applies the medium/high severity and confidence floor by default" {
  export GH_TOKEN='token-from-env'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains '--min-severity medium'
  assert_log_contains '--min-confidence high'
  assert_log_contains '--persona regular'
}

@test "the floor is overridable so it can be ratcheted up" {
  export GH_TOKEN='token-from-env'
  export ZIZMOR_MIN_SEVERITY='low'
  export ZIZMOR_MIN_CONFIDENCE='low'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains '--min-severity low'
  assert_log_contains '--min-confidence low'
}

@test "audits an explicit target when one is given" {
  export GH_TOKEN='token-from-env'
  export ZIZMOR_TARGETS='.github/'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains '.github/'
}

@test "mounts the workspace read-only" {
  export GH_TOKEN='token-from-env'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains ':/repo:ro'
}

@test "forwards the token by name so its value never enters the docker argv" {
  # `-e GH_TOKEN=<value>` would put the credential in the docker process's argv,
  # readable by any local user via `ps`. Only the variable NAME may appear.
  export GH_TOKEN='super-secret-token-value'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains '-e GH_TOKEN'
  ! grep -Fq 'super-secret-token-value' "$COMMAND_LOG"
}

@test "does not leak a gh-CLI-sourced token into the docker argv either" {
  create_gh_stub 'secret-from-gh-cli'

  run_lint_workflows
  [ "$status" -eq 0 ]
  ! grep -Fq 'secret-from-gh-cli' "$COMMAND_LOG"
}

@test "the gh-CLI-resolved token still reaches the container environment" {
  create_gh_stub 'secret-from-gh-cli'
  create_token_recording_docker_stub

  run_lint_workflows
  [ "$status" -eq 0 ]
  # Present in the environment...
  [ "$(cat "$TOKEN_SEEN")" = 'secret-from-gh-cli' ]
  # ...and still absent from the command line.
  ! grep -Fq 'secret-from-gh-cli' "$COMMAND_LOG"
}

@test "the GH_TOKEN-supplied token reaches the container environment" {
  export GH_TOKEN='secret-from-env'
  create_token_recording_docker_stub

  run_lint_workflows
  [ "$status" -eq 0 ]
  [ "$(cat "$TOKEN_SEEN")" = 'secret-from-env' ]
  ! grep -Fq 'secret-from-env' "$COMMAND_LOG"
}

@test "the token-recording stub reports nothing when -e GH_TOKEN is not passed" {
  # Guards the guard. lint-workflows.sh `export`s GH_TOKEN before calling docker,
  # so a stub that read the variable from its own environment would record it even
  # with the flag misspelled (`-e GH_TOKENN`) or dropped entirely -- the two tests
  # above would stay green while every online audit was silently disabled. Drive
  # the stub directly, with the token exported exactly as the script exports it,
  # and confirm it only reports a token when the real flag pair is on the argv.
  create_token_recording_docker_stub
  export GH_TOKEN='secret-from-env'

  COMMAND_LOG="$COMMAND_LOG" TOKEN_SEEN="$TOKEN_SEEN" \
    "$STUB_BIN_DIR/docker" run --rm -e GH_TOKENN some-image --no-progress
  [ -z "$(cat "$TOKEN_SEEN")" ]

  COMMAND_LOG="$COMMAND_LOG" TOKEN_SEEN="$TOKEN_SEEN" \
    "$STUB_BIN_DIR/docker" run --rm some-image --no-progress
  [ -z "$(cat "$TOKEN_SEEN")" ]

  COMMAND_LOG="$COMMAND_LOG" TOKEN_SEEN="$TOKEN_SEEN" \
    "$STUB_BIN_DIR/docker" run --rm -e GH_TOKEN some-image --no-progress
  [ "$(cat "$TOKEN_SEEN")" = 'secret-from-env' ]
}

# --- Negative ------------------------------------------------------------------

@test "fails when ZIZMOR_IMAGE is not set" {
  unset ZIZMOR_IMAGE

  run_lint_workflows
  [ "$status" -ne 0 ]
  assert_output_contains 'ZIZMOR_IMAGE'
}

@test "refuses a tag-pinned image instead of auditing whatever the tag points at" {
  # The header of lint-workflows.sh promises the image is pinned by digest so a
  # repointed tag cannot change what the security gate enforces. Documenting that
  # is not enforcing it: a tag still runs, still exits 0, and still reports green
  # while auditing something nobody reviewed. It must fail closed.
  export GH_TOKEN='token-from-env'
  export ZIZMOR_IMAGE='ghcr.io/zizmorcore/zizmor:1.28.0'

  run_lint_workflows
  [ "$status" -eq 1 ]
  assert_output_contains 'not digest-pinned'
  # And it must refuse BEFORE reaching docker.
  [ ! -s "$COMMAND_LOG" ]
}

@test "refuses a digest that is not 64 lowercase hex characters" {
  export GH_TOKEN='token-from-env'

  export ZIZMOR_IMAGE='ghcr.io/zizmorcore/zizmor@sha256:abc123'
  run_lint_workflows
  [ "$status" -eq 1 ]
  assert_output_contains 'not 64 lowercase hex characters'

  # Right length, wrong alphabet -- a truncated-then-padded digest must not pass.
  export ZIZMOR_IMAGE="ghcr.io/zizmorcore/zizmor@sha256:ZZ${DIGEST_IMAGE##*@sha256:}"
  run_lint_workflows
  [ "$status" -eq 1 ]
  assert_output_contains 'not 64 lowercase hex characters'
}

@test "propagates a nonzero zizmor exit code instead of swallowing it" {
  export GH_TOKEN='token-from-env'
  # zizmor exits 14 when its highest finding is high severity.
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"
exit 14
EOF
  chmod +x "$STUB_BIN_DIR/docker"

  run_lint_workflows
  [ "$status" -eq 14 ]
}

# --- Boundary ------------------------------------------------------------------

@test "falls back to the gh CLI token when GH_TOKEN is unset" {
  create_gh_stub 'token-from-gh'

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains 'gh auth token'
  # A token was found, so the online audits must NOT be skipped.
  ! grep -Fq -- '--offline' "$COMMAND_LOG"
}

@test "prefers GITHUB_TOKEN over the gh CLI when GH_TOKEN is unset" {
  export GITHUB_TOKEN='token-from-actions'
  create_gh_stub 'token-from-gh'

  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    ZIZMOR_IMAGE="$ZIZMOR_IMAGE" \
    GITHUB_TOKEN="$GITHUB_TOKEN" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 0 ]
  ! grep -Fq 'gh auth token' "$COMMAND_LOG"
  ! grep -Fq -- '--offline' "$COMMAND_LOG"
}

@test "degrades to --offline with a notice when no token is available at all" {
  # No GH_TOKEN, no GITHUB_TOKEN, and gh returns nothing (not logged in).
  create_gh_stub '' 1

  run_lint_workflows
  [ "$status" -eq 0 ]
  assert_log_contains '--offline'
  assert_output_contains 'running --offline'
}

@test "degrades to --offline when the gh CLI is not installed" {
  # PATH is the stub dir alone, so `command -v gh` genuinely finds nothing --
  # merely prepending would let a real, logged-in gh on the developer's machine
  # answer and leak a live token into the command log. That means the stub and
  # the shell must both be reachable without PATH, hence absolute interpreters.
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/bin/sh
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"
exit 0
EOF
  chmod +x "$STUB_BIN_DIR/docker"

  run env -i \
    PATH="$STUB_BIN_DIR" \
    COMMAND_LOG="$COMMAND_LOG" \
    ZIZMOR_IMAGE="$ZIZMOR_IMAGE" \
    "${BASH:-/bin/bash}" "$PROJECT_ROOT/$SCRIPT_REL"
  [ "$status" -eq 0 ]
  assert_log_contains '--offline'
}
