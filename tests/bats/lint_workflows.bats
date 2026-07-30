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
    ZIZMOR_IMAGE="${ZIZMOR_IMAGE-}" \
    ZIZMOR_MIN_SEVERITY="${ZIZMOR_MIN_SEVERITY-}" \
    ZIZMOR_MIN_CONFIDENCE="${ZIZMOR_MIN_CONFIDENCE-}" \
    ZIZMOR_TARGETS="${ZIZMOR_TARGETS-}" \
    GH_TOKEN="${GH_TOKEN-}" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
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

# --- Negative ------------------------------------------------------------------

@test "fails when ZIZMOR_IMAGE is not set" {
  unset ZIZMOR_IMAGE

  run_lint_workflows
  [ "$status" -ne 0 ]
  assert_output_contains 'ZIZMOR_IMAGE'
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
