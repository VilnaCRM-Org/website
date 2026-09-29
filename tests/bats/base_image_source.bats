#!/usr/bin/env bats
#
# Coverage for scripts/ci/base-image-source.sh (issues #509, #506).
#
# The dev-container composite builds the Dockerfile's `base` stage. When ECR
# Public refuses the anonymous manifest fetch (`429 toomanyrequests: Data limit
# exceeded`), the build is redirected to the same digest on mirror.gcr.io. The
# redirect is only safe because the digest travels with it, so the cases below
# pin the derivation itself: the real Dockerfile parses, the mirror keeps the
# digest byte for byte, and every ref the derivation cannot vouch for is refused
# rather than guessed. Each refusal case mutates exactly one invariant of a copy
# of the committed Dockerfile.

bats_require_minimum_version 1.5.0

load './test_helper.bash'

SCRIPT_REL='scripts/ci/base-image-source.sh'
DIGEST='595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436'
FIXTURE_REF="public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:$DIGEST"

setup() {
  setup_stub_dir
  FIXTURE="$BATS_TEST_TMPDIR/Dockerfile"
  cp "$PROJECT_ROOT/Dockerfile" "$FIXTURE"
}

# Replace the committed `FROM … AS base` line of the fixture with $1, verbatim.
set_base_line() {
  local replacement="$1" line
  local out="$FIXTURE.new"
  : >"$out"
  while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^FROM[[:space:]].*[[:space:]]AS[[:space:]]+base$ ]]; then
      printf '%s\n' "$replacement" >>"$out"
    else
      printf '%s\n' "$line" >>"$out"
    fi
  done <"$FIXTURE"
  mv "$out" "$FIXTURE"
}

# A docker stub whose `buildx imagetools inspect` answers like a registry that
# serves the manifest (exit 0) or refuses it with $FAKE_REGISTRY_ERROR (exit 1).
create_registry_stub() {
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"
if [ -n "${FAKE_REGISTRY_SLEEP:-}" ]; then
  sleep "$FAKE_REGISTRY_SLEEP"
fi
if [ -n "${FAKE_REGISTRY_ERROR:-}" ]; then
  printf '%s\n' "$FAKE_REGISTRY_ERROR" >&2
  exit 1
fi
printf '{"schemaVersion":2}\n'
EOF
  chmod +x "$STUB_BIN_DIR/docker"
}

run_source() {
  # Unset, because the bats job itself runs under GitHub Actions, where it is set.
  run --separate-stderr env -u GITHUB_OUTPUT PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" bash "$PROJECT_ROOT/$SCRIPT_REL" "$@"
}

assert_refused() {
  [ "$status" -eq 1 ]
  [ -z "$output" ]
  [[ "$stderr" == *'::error::'* ]]
}

# --- The committed Dockerfile ---------------------------------------------------

@test "parses the committed Dockerfile's base stage verbatim" {
  local expected
  expected="$(sed -nE 's/^FROM ([^ ]+) AS base$/\1/p' "$PROJECT_ROOT/Dockerfile")"
  [ -n "$expected" ]

  run_source "$PROJECT_ROOT/Dockerfile"
  assert_success
  [ "${lines[0]}" = "ref=$expected" ]
}

@test "derives the mirror ref from the committed Dockerfile with the same digest" {
  local ref digest name
  ref="$(sed -nE 's/^FROM ([^ ]+) AS base$/\1/p' "$PROJECT_ROOT/Dockerfile")"
  digest="${ref##*@sha256:}"
  name="${ref#public.ecr.aws/docker/library/}"
  name="${name%%[:@]*}"
  [ "${#digest}" -eq 64 ]

  run_source "$PROJECT_ROOT/Dockerfile"
  assert_success
  [ "${lines[1]}" = "mirror=mirror.gcr.io/library/$name@sha256:$digest" ]
  [ "${lines[2]}" = "mirror-contexts=$ref=docker-image://mirror.gcr.io/library/$name@sha256:$digest" ]
  [ "${#lines[@]}" -eq 3 ]
}

@test "drops the tag from the mirror ref and keeps the digest" {
  set_base_line "FROM $FIXTURE_REF AS base"

  run_source "$FIXTURE"
  assert_success
  [ "${lines[0]}" = "ref=$FIXTURE_REF" ]
  [ "${lines[1]}" = "mirror=mirror.gcr.io/library/node@sha256:$DIGEST" ]
}

@test "keeps the digest of any ECR Public library image, not just node" {
  local other='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  set_base_line "FROM public.ecr.aws/docker/library/golang:1.25.11-alpine3.22@sha256:$other AS base"

  run_source "$FIXTURE"
  assert_success
  [ "${lines[1]}" = "mirror=mirror.gcr.io/library/golang@sha256:$other" ]
}

@test "accepts a digest-only ref and lower-case keywords" {
  set_base_line "from public.ecr.aws/docker/library/node@sha256:$DIGEST as base"

  run_source "$FIXTURE"
  assert_success
  [ "${lines[0]}" = "ref=public.ecr.aws/docker/library/node@sha256:$DIGEST" ]
  [ "${lines[1]}" = "mirror=mirror.gcr.io/library/node@sha256:$DIGEST" ]
}

@test "defaults to ./Dockerfile" {
  cd "$BATS_TEST_TMPDIR"
  run_source
  assert_success
  [[ "${lines[1]}" == "mirror=mirror.gcr.io/library/node@sha256:"* ]]
}

# --- Refusals: never derive a mirror the digest does not vouch for ------------

@test "refuses a tag-only base image" {
  set_base_line 'FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base'
  run_source "$FIXTURE"
  assert_refused
  [[ "$stderr" == *'refusing to derive a mirror'* ]]
}

@test "refuses an implicit Docker Hub base image" {
  set_base_line "FROM node:24.18.0-alpine3.23@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses an explicit Docker Hub base image" {
  set_base_line "FROM docker.io/library/node:24.18.0-alpine3.23@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a docker/library path on a registry other than ECR Public" {
  set_base_line "FROM docker.io/docker/library/node:24@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses an ECR Public path outside docker/library" {
  set_base_line "FROM public.ecr.aws/someone/node:24@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a nested repository under docker/library" {
  set_base_line "FROM public.ecr.aws/docker/library/node/extra:24@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a short digest" {
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:${DIGEST:0:63} AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses an empty digest" {
  set_base_line 'FROM public.ecr.aws/docker/library/node:24@sha256: AS base'
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses an upper-case digest" {
  local upper
  upper="$(printf '%s' "$DIGEST" | tr '[:lower:]' '[:upper:]')"
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:$upper AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a variable-valued digest" {
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:\${NODE_DIGEST} AS base"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a --platform flag instead of guessing which token is the image" {
  set_base_line "FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:24@sha256:$DIGEST AS base"
  run_source "$FIXTURE"
  assert_refused
  [[ "$stderr" == *"no single-line 'FROM <image> AS base'"* ]]
}

@test "refuses a Dockerfile with no base stage" {
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:$DIGEST AS runtime"
  run_source "$FIXTURE"
  assert_refused
}

@test "refuses a Dockerfile with two base stages" {
  printf '\nFROM public.ecr.aws/docker/library/node:24@sha256:%s AS base\n' "$DIGEST" >>"$FIXTURE"
  run_source "$FIXTURE"
  assert_refused
  [[ "$stderr" == *"2 'AS base' stages"* ]]
}

@test "refuses a missing Dockerfile" {
  run_source "$BATS_TEST_TMPDIR/absent/Dockerfile"
  assert_refused
}

@test "rejects an unknown flag and a second path as usage errors" {
  run_source --pull "$FIXTURE"
  [ "$status" -eq 2 ]
  run_source "$FIXTURE" "$FIXTURE"
  [ "$status" -eq 2 ]
}

# --- --probe: choose the source ------------------------------------------------

@test "keeps ECR Public when it serves the manifest" {
  create_registry_stub
  set_base_line "FROM $FIXTURE_REF AS base"

  run_source --probe "$FIXTURE"
  assert_success
  [ "${lines[3]}" = 'source=origin' ]
  [ "${lines[4]}" = 'build-contexts=' ]
  [ -z "$stderr" ]
  assert_log_contains "docker buildx imagetools inspect --raw $FIXTURE_REF"
}

@test "switches to the mirror and names the registry's refusal" {
  create_registry_stub
  set_base_line "FROM $FIXTURE_REF AS base"
  export FAKE_REGISTRY_ERROR='toomanyrequests: Data limit exceeded'

  run_source --probe "$FIXTURE"
  assert_success
  local contexts="${lines[2]#mirror-contexts=}"
  [ "${lines[3]}" = 'source=mirror' ]
  [ "${lines[4]}" = "build-contexts=$contexts" ]
  [[ "$stderr" == '::warning::'*'toomanyrequests: Data limit exceeded'* ]]
  [[ "$stderr" == *"mirror.gcr.io/library/node@sha256:$DIGEST"* ]]
}

@test "escapes the registry's text so it cannot start a workflow command" {
  create_registry_stub
  set_base_line "FROM $FIXTURE_REF AS base"
  export FAKE_REGISTRY_ERROR=$'429 Too Many Requests\n::error::forged\r\n100% refused'

  run_source --probe "$FIXTURE"
  assert_success
  [ "${#stderr_lines[@]}" -eq 1 ]
  [[ "$stderr" == *'%0A::error::forged%0D%0A100%25 refused'* ]]
}

@test "treats an unanswered probe as a refusal" {
  create_registry_stub
  set_base_line "FROM $FIXTURE_REF AS base"
  export FAKE_REGISTRY_SLEEP=5 PROBE_TIMEOUT=1

  run_source --probe "$FIXTURE"
  assert_success
  [ "${lines[3]}" = 'source=mirror' ]
  [[ "$stderr" == *'no answer within 1s'* ]]
}

@test "appends the step outputs to \$GITHUB_OUTPUT instead of stdout when it is set" {
  create_registry_stub
  set_base_line "FROM $FIXTURE_REF AS base"
  export FAKE_REGISTRY_ERROR='toomanyrequests: Data limit exceeded'
  local outputs="$BATS_TEST_TMPDIR/github-output"
  printf 'earlier=kept\n' >"$outputs"

  run --separate-stderr env PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_OUTPUT="$outputs" bash "$PROJECT_ROOT/$SCRIPT_REL" --probe "$FIXTURE"
  assert_success
  [ -z "$output" ]
  [ "$(sed -n 1p "$outputs")" = 'earlier=kept' ]
  [ "$(sed -n 2p "$outputs")" = "ref=$FIXTURE_REF" ]
  [ "$(sed -n 5p "$outputs")" = 'source=mirror' ]
  [ "$(sed -n 6p "$outputs")" = "build-contexts=$FIXTURE_REF=docker-image://mirror.gcr.io/library/node@sha256:$DIGEST" ]
  [ "$(wc -l <"$outputs")" -eq 6 ]
}

@test "never probes a registry for a ref it refused to parse" {
  create_registry_stub
  set_base_line 'FROM public.ecr.aws/docker/library/node:24 AS base'

  run_source --probe "$FIXTURE"
  assert_refused
  [ ! -s "$COMMAND_LOG" ]
}
