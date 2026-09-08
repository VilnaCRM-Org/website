#!/usr/bin/env bats
#
# Coverage for scripts/ci/scan-secrets.sh and the .gitleaks.toml allowlist
# (issue #353) -- the committed-secrets gate.
#
# Two layers, because they fail in different ways:
#
#   * Contract tests with docker stubbed. These pin what the script HANDS the
#     scanner: the digest-pinned image, the committed config, `--exit-code 1`,
#     `--redact`, and the one flag that distinguishes the two modes (`--no-git`).
#     Every one of those is silent when wrong -- a dropped `--exit-code 1` still
#     prints findings and still exits 0, leaving a green check that scans
#     everything and blocks nothing.
#
#   * A seeded-defect test against the REAL pinned image (AC3). A gate nobody
#     has watched go red is a gate nobody knows works, and stubs cannot prove
#     gitleaks itself still matches on the ruleset this repo ships.
#
# The allowlist gets its own invariant: every build-output path exempted in
# .gitleaks.toml must genuinely be gitignored. That is the entire justification
# for exempting them -- a path git can never commit cannot hide a committed
# secret -- so it is asserted rather than left as a comment that rots.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/scan-secrets.sh'

DIGEST_IMAGE='ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb3071cbcb79009cb16a60dd9e0a7c60e2be9ab65d25e6bc8abbb7f'

setup() {
  # Captured BEFORE the stub dir is prepended to PATH. The seeded-defect tests
  # below must reach the REAL docker; without this they inherit the stub, which
  # exits 0 for every command -- so the "credential is detected" case would fail
  # while the "clean tree is green" case passed vacuously.
  REAL_PATH="$PATH"
  setup_stub_dir
  create_docker_stub
  WORKSPACE="$BATS_TEST_TMPDIR/ws"
  mkdir -p "$WORKSPACE"
  cp "$PROJECT_ROOT/.gitleaks.toml" "$WORKSPACE/.gitleaks.toml"
}

run_scan() {
  run env \
    PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" \
    GITLEAKS_IMAGE="${GITLEAKS_IMAGE-$DIGEST_IMAGE}" \
    SECRETS_MODE="${SECRETS_MODE-}" \
    GITHUB_WORKSPACE="$WORKSPACE" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

# --- mode contract ----------------------------------------------------------

@test "tree mode passes --no-git and the committed config, and fails closed on findings" {
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"--no-git"* ]]
  [[ "$output" == *"--config /repo/.gitleaks.toml"* ]]
  [[ "$output" == *"--exit-code 1"* ]]
  [[ "$output" == *"--redact"* ]]
  [[ "$output" == *"$DIGEST_IMAGE"* ]]
  [[ "$output" == *"-v $WORKSPACE:/repo"* ]]
}

@test "tree is the default mode when SECRETS_MODE is unset" {
  run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" == *"--no-git"* ]]
}

@test "history mode drops --no-git so git history is actually walked" {
  git -C "$WORKSPACE" init -q
  SECRETS_MODE=history run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  # The whole point of the history leg. If --no-git leaked in here the job
  # would scan the tip checkout twice and report a clean history it never read.
  [[ "$output" != *"--no-git"* ]]
  [[ "$output" == *"--exit-code 1"* ]]
}

@test "history mode exempts the mount from git's dubious-ownership refusal" {
  git -C "$WORKSPACE" init -q
  SECRETS_MODE=history run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  # In CI the checkout is owned by the runner user and the container runs as
  # root; without this git aborts and the scan reports a tooling failure.
  [[ "$output" == *"GIT_CONFIG_COUNT=1"* ]]
  [[ "$output" == *"GIT_CONFIG_KEY_0=safe.directory"* ]]
  [[ "$output" == *"GIT_CONFIG_VALUE_0=/repo"* ]]
}

@test "tree mode does not pass the git ownership exemption it does not need" {
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 0 ]
  run cat "$COMMAND_LOG"
  [[ "$output" != *"GIT_CONFIG_COUNT"* ]]
}

# --- fail-closed guards -----------------------------------------------------

@test "a tag instead of a digest is refused" {
  GITLEAKS_IMAGE='ghcr.io/gitleaks/gitleaks:v8.30.1' SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"not digest-pinned"* ]]
}

@test "a truncated digest is refused" {
  GITLEAKS_IMAGE='ghcr.io/gitleaks/gitleaks@sha256:c00b6bd0aeb' SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "an unknown mode is refused rather than silently scanning the tree" {
  SECRETS_MODE=deep run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"must be 'tree' or 'history'"* ]]
}

@test "a missing config is refused rather than falling back to gitleaks defaults" {
  rm -f "$WORKSPACE/.gitleaks.toml"
  SECRETS_MODE=tree run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"not found"* ]]
}

@test "history mode without a git directory is refused, not passed vacuously" {
  SECRETS_MODE=history run_scan
  [ "$status" -eq 1 ]
  [[ "$output" == *"fetch-depth: 0"* ]]
}

# --- allowlist invariant ----------------------------------------------------

@test "every build-output path exempted in .gitleaks.toml is genuinely gitignored" {
  # The exemption is only defensible because git cannot commit these paths.
  #
  # Probe a path INSIDE each directory, never the bare directory name. All three
  # patterns are written directory-only (`/.next/`), and `git check-ignore` only
  # matches such a pattern against a name that is actually a directory on disk.
  # A developer's tree has them, a clean CI checkout does not -- so the bare form
  # passes locally and fails in CI for a reason that has nothing to do with the
  # allowlist. The nested form is decided by the ignore rules alone.
  for path in .next out storybook-static-ci; do
    grep -qF "(/repo/)?${path//./\\.}/" "$PROJECT_ROOT/.gitleaks.toml" \
      || { echo "expected $path to be exempted in .gitleaks.toml"; false; }
    run git -C "$PROJECT_ROOT" check-ignore -q "$path/probe"
    [ "$status" -eq 0 ] || { echo "$path is exempted but NOT gitignored"; false; }
  done
}

# --- the gate actually reddens (AC3) ----------------------------------------

real_docker_or_skip() {
  PATH="$REAL_PATH" command -v docker >/dev/null 2>&1 || skip 'docker not installed'
  PATH="$REAL_PATH" docker info >/dev/null 2>&1 || skip 'docker daemon not running'
}

run_real_scan() {
  run env \
    PATH="$REAL_PATH" \
    GITLEAKS_IMAGE="$DIGEST_IMAGE" \
    SECRETS_MODE=tree \
    GITHUB_WORKSPACE="$WORKSPACE" \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

@test "real gitleaks: a seeded credential turns the gate red" {
  real_docker_or_skip
  # A fabricated GitHub PAT -- the credential class this repo actually leaked
  # once (#135), and one gitleaks' bundled `github-pat` rule matches reliably.
  #
  # The literal is ASSEMBLED AT RUNTIME and never appears whole in this file.
  # Writing it out would make the fixture a finding in the repo's own working
  # tree, so `make lint-secrets` would go red on the test that proves it works
  # -- and the only ways out of that would be exempting the test file or
  # weakening the rule, i.e. blunting the gate to keep its own test green.
  local token="ghp_$(printf '%s' '9Xk2LmQ4vRt7WyZa1BcDeFgHiJkLmN0oPqRs')"
  printf 'github_token = %s\n' "$token" >"$WORKSPACE/leak.tf"
  run_real_scan
  [ "$status" -eq 1 ]
}

@test "real gitleaks: the same workspace without the credential is green" {
  real_docker_or_skip
  # Proves the previous case failed on the seeded secret and not on some
  # unrelated property of the fixture -- without this pair, a scanner that
  # errored on every input would look like a working gate.
  printf 'aws_region = eu-central-1\n' >"$WORKSPACE/clean.tf"
  run_real_scan
  [ "$status" -eq 0 ]
}
