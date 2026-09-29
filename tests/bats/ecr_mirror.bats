#!/usr/bin/env bats
#
# Coverage for scripts/ci/ecr-mirror.sh and the Makefile's ECR_MIRROR wiring
# (ADR 0014; issues #509, #506, and the ECR-quota share of #485).
#
# CI builds redirect an ECR Public base that ECR refuses to the same digest on
# mirror.gcr.io. The redirect is only safe because the digest travels with it,
# so the cases below pin the derivation itself: every committed Dockerfile's
# ECR refs map to mirror refs with the same digest, and every ECR ref the
# derivation cannot vouch for fails the run rather than being guessed. Refusal
# cases mutate exactly one invariant of a copy of the committed Dockerfile.

bats_require_minimum_version 1.5.0

load './test_helper.bash'

SCRIPT_REL='scripts/ci/ecr-mirror.sh'
DIGEST='595398b0081eacda8e1c4c5b97b76cd1020e4d58a8ebcb4843b9bca1e79e7436'
OTHER='0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
FIXTURE_REF="public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:$DIGEST"
FIXTURE_CONTEXT="$FIXTURE_REF=docker-image://mirror.gcr.io/library/node@sha256:$DIGEST"

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

write_dockerfile() {
  printf '%s\n' "$@" >"$FIXTURE"
}

# A docker stub whose `buildx imagetools inspect` answers like ECR Public: it
# refuses every ref matching $FAKE_REFUSE (a bash glob, default: none) with
# $FAKE_REGISTRY_ERROR, and serves the rest.
create_registry_stub() {
  cat >"$STUB_BIN_DIR/docker" <<'EOF'
#!/usr/bin/env bash
printf 'docker %s\n' "$*" >> "${COMMAND_LOG:?}"
if [ "$1" = compose ]; then
  if [ -n "${FAKE_COMPOSE_FAIL:-}" ]; then
    echo 'service "prod" refers to undefined network' >&2
    exit 15
  fi
  cat "${FAKE_COMPOSE_CONFIG:?}"
  exit 0
fi
ref="${*: -1}"
if [ -n "${FAKE_REGISTRY_SLEEP:-}" ]; then
  sleep "$FAKE_REGISTRY_SLEEP"
fi
case "$ref" in
  ${FAKE_REFUSE:-/no-ref-matches/})
    printf '%s\n' "${FAKE_REGISTRY_ERROR:-toomanyrequests: Data limit exceeded}" >&2
    exit 1
    ;;
esac
printf '{"schemaVersion":2}\n'
EOF
  chmod +x "$STUB_BIN_DIR/docker"
}

# Unset GITHUB_OUTPUT, because the bats job itself runs under GitHub Actions.
run_mirror() {
  run --separate-stderr env -u GITHUB_OUTPUT PATH="$STUB_BIN_DIR:$PATH" \
    COMMAND_LOG="$COMMAND_LOG" bash "$PROJECT_ROOT/$SCRIPT_REL" "$@"
}

assert_refused() {
  [ "$status" -eq 1 ]
  [ -z "$output" ]
  [[ "$stderr" == *'::error::'* ]]
}

# --- The committed Dockerfiles -------------------------------------------------

@test "every committed Dockerfile's ECR bases map to mirror refs with the same digest" {
  local dockerfile ref expected found=0
  while IFS= read -r dockerfile; do
    run_mirror contexts "$PROJECT_ROOT/$dockerfile"
    assert_success
    while IFS= read -r ref; do
      found=$((found + 1))
      local name="${ref#public.ecr.aws/docker/library/}"
      expected="$ref=docker-image://mirror.gcr.io/library/${name%%[:@]*}@sha256:${ref##*@sha256:}"
      [[ $'\n'"$output"$'\n' == *$'\n'"$expected"$'\n'* ]] || {
        echo "$dockerfile: no context '$expected' in: $output" >&2
        return 1
      }
    done < <(sed -nE 's#^FROM (public\.ecr\.aws/docker/library/[^ ]+).*#\1#p' "$PROJECT_ROOT/$dockerfile" | sort -u)
    [ "${#lines[@]}" -eq "$(sed -nE 's#^FROM (public\.ecr\.aws/docker/library/[^ ]+).*#\1#p' "$PROJECT_ROOT/$dockerfile" | sort -u | wc -l)" ]
  done < <(git -C "$PROJECT_ROOT" ls-files '*Dockerfile*')
  [ "$found" -gt 0 ]
}

@test "redirects the dev Dockerfile's single distinct base once" {
  run_mirror contexts "$PROJECT_ROOT/Dockerfile"
  assert_success
  [ "${#lines[@]}" -eq 1 ]
}

@test "de-duplicates refs across several Dockerfiles, in first-seen order" {
  local second="$BATS_TEST_TMPDIR/Second.Dockerfile"
  printf 'FROM public.ecr.aws/docker/library/golang:1@sha256:%s AS builder\nFROM %s\n' \
    "$OTHER" "$FIXTURE_REF" >"$second"
  set_base_line "FROM $FIXTURE_REF AS base"

  run_mirror contexts "$FIXTURE" "$second"
  assert_success
  [ "${#lines[@]}" -eq 2 ]
  [ "${lines[0]}" = "$FIXTURE_CONTEXT" ]
  [ "${lines[1]}" = "public.ecr.aws/docker/library/golang:1@sha256:$OTHER=docker-image://mirror.gcr.io/library/golang@sha256:$OTHER" ]
}

# --- Parsing ---------------------------------------------------------------------

@test "drops the tag from the mirror ref and keeps the digest" {
  write_dockerfile "FROM $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "accepts a digest-only ref and lower-case keywords" {
  write_dockerfile "from public.ecr.aws/docker/library/node@sha256:$DIGEST as base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "public.ecr.aws/docker/library/node@sha256:$DIGEST=docker-image://mirror.gcr.io/library/node@sha256:$DIGEST" ]
}

@test "reads the image after a --platform flag" {
  write_dockerfile "FROM --platform=linux/amd64 $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "folds a FROM continued over several lines" {
  write_dockerfile 'FROM \' "    $FIXTURE_REF \\" '    AS base'
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

# The continuation cases below each mirror a Dockerfile that was run through a
# real `docker buildx build` with a named context keyed on the ref: where BuildKit
# fetched the mirror, the script must derive that context; where BuildKit could
# not parse the file, the script must derive nothing it would not also refuse.

@test "continues a line whose backslash is followed by spaces or a tab, as BuildKit does" {
  write_dockerfile 'FROM \   ' "    $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]

  write_dockerfile $'FROM \\\t \t' "    $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "still refuses a tag-only ECR ref behind a backslash with trailing whitespace" {
  write_dockerfile 'FROM \  ' '    public.ecr.aws/docker/library/node:24 AS base'
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "does not continue a line whose backslash is followed by a form feed or vertical tab" {
  write_dockerfile $'FROM \\\f' "    $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ -z "$output" ]

  write_dockerfile $'FROM \\\v' "    $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ -z "$output" ]
}

@test "skips blank and whitespace-only lines inside a continuation" {
  write_dockerfile 'FROM \' '' $'   \t ' $'\f' "    $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "joins a continuation with no separator, so a split ref is read whole" {
  write_dockerfile "FROM ${FIXTURE_REF:0:40}\\" "${FIXTURE_REF:40} AS base"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "refuses a tag-only ECR ref split inside its namespace" {
  # Joined with a space, the first half would read as an image outside
  # docker/library and be skipped, while BuildKit pulls the whole tag-only ref.
  write_dockerfile 'FROM public.ecr.aws/docker/lib\' 'rary/node:24 AS base'
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "keeps a continuation line's leading whitespace, as BuildKit does" {
  write_dockerfile "FROM ${FIXTURE_REF:0:40}\\" "   ${FIXTURE_REF:40} AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "does not fold a backslash-ended comment into the FROM after it" {
  write_dockerfile '# pinned below \' "FROM $FIXTURE_REF AS base" \
    '  # indented too \' "FROM public.ecr.aws/docker/library/golang:1@sha256:$OTHER"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "${#lines[@]}" -eq 2 ]
  [ "${lines[0]}" = "$FIXTURE_CONTEXT" ]
}

@test "still refuses a tag-only ECR ref behind a backslash-ended comment" {
  write_dockerfile '# pinned below \' 'FROM public.ecr.aws/docker/library/node:24 AS base'
  run_mirror contexts "$FIXTURE"
  assert_refused
  [[ "$stderr" == *'refusing to derive a mirror'* ]]
}

@test "leaves build stages, scratch and other registries alone" {
  write_dockerfile \
    "FROM $FIXTURE_REF AS Base" \
    'FROM base AS build' \
    'FROM BUILD AS copy' \
    'FROM scratch AS empty' \
    "FROM mcr.microsoft.com/playwright:v1.57.0-jammy@sha256:$OTHER" \
    "FROM ghcr.io/example/tool@sha256:$OTHER"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
}

@test "does not redirect Docker Hub or another ECR namespace, which it cannot vouch for" {
  write_dockerfile \
    "FROM node:24@sha256:$DIGEST AS a" \
    "FROM docker.io/library/node:24@sha256:$DIGEST AS b" \
    "FROM docker.io/docker/library/node:24@sha256:$DIGEST AS c" \
    "FROM public.ecr.aws/someone/node:24@sha256:$DIGEST AS d"
  run_mirror contexts "$FIXTURE"
  assert_success
  [ -z "$output" ]
}

# --- Refusals: never derive a mirror the digest does not vouch for ------------

@test "refuses a tag-only ECR base image" {
  set_base_line 'FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23 AS base'
  run_mirror contexts "$FIXTURE"
  assert_refused
  [[ "$stderr" == *'refusing to derive a mirror'* ]]
}

@test "refuses a nested repository under docker/library" {
  set_base_line "FROM public.ecr.aws/docker/library/node/extra:24@sha256:$DIGEST AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses a short digest" {
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:${DIGEST:0:63} AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses an empty digest" {
  set_base_line 'FROM public.ecr.aws/docker/library/node:24@sha256: AS base'
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses an upper-case digest" {
  local upper
  upper="$(printf '%s' "$DIGEST" | tr '[:lower:]' '[:upper:]')"
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:$upper AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses a variable-valued digest" {
  set_base_line "FROM public.ecr.aws/docker/library/node:24@sha256:\${NODE_DIGEST} AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses a bad ECR ref in a later stage, not only in the base stage" {
  printf '\nFROM public.ecr.aws/docker/library/alpine:3.21 AS late\n' >>"$FIXTURE"
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses a Dockerfile with an escape parser directive" {
  write_dockerfile '# escape=`' "FROM $FIXTURE_REF AS base"
  run_mirror contexts "$FIXTURE"
  assert_refused
  [[ "$stderr" == *'escape='* ]]
}

@test "refuses a FROM with no image" {
  write_dockerfile 'FROM --platform=linux/amd64'
  run_mirror contexts "$FIXTURE"
  assert_refused
}

@test "refuses a missing Dockerfile" {
  run_mirror contexts "$BATS_TEST_TMPDIR/absent/Dockerfile"
  assert_refused
}

@test "rejects an unknown subcommand and missing operands as usage errors" {
  run_mirror
  [ "$status" -eq 2 ]
  run_mirror resolve "$FIXTURE"
  [ "$status" -eq 2 ]
  run_mirror contexts
  [ "$status" -eq 2 ]
  run_mirror compose-override "$BATS_TEST_TMPDIR/out.json"
  [ "$status" -eq 2 ]
  run_mirror github-output
  [ "$status" -eq 2 ]
}

# --- --probe: redirect only what ECR Public refuses ---------------------------

@test "redirects nothing when ECR Public serves every manifest" {
  create_registry_stub
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ -z "$output" ]
  [ -z "$stderr" ]
  assert_log_contains "docker buildx imagetools inspect --raw $FIXTURE_REF"
}

@test "redirects only the refused ref and names the registry's refusal" {
  create_registry_stub
  export FAKE_REFUSE='*node*'
  write_dockerfile "FROM $FIXTURE_REF AS base" \
    "FROM public.ecr.aws/docker/library/alpine:3.21@sha256:$OTHER AS tools"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
  [[ "$stderr" == '::warning::'*'toomanyrequests: Data limit exceeded'* ]]
  [[ "$stderr" == *"mirror.gcr.io/library/node@sha256:$DIGEST"* ]]
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 2 ]
}

@test "probes each distinct ref once" {
  create_registry_stub
  write_dockerfile "FROM $FIXTURE_REF AS base" "FROM $FIXTURE_REF AS again"

  run_mirror contexts --probe "$FIXTURE" "$FIXTURE"
  assert_success
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 1 ]
}

@test "reuses a recorded refusal across calls that share ECR_MIRROR_VERDICTS" {
  create_registry_stub
  export FAKE_REFUSE='*node*' ECR_MIRROR_VERDICTS="$BATS_TEST_TMPDIR/verdicts.tsv"
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]

  export FAKE_REFUSE='/no-ref-matches/'
  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
  [ -z "$stderr" ]
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 1 ]
}

@test "reuses a recorded answer across calls that share ECR_MIRROR_VERDICTS" {
  create_registry_stub
  export ECR_MIRROR_VERDICTS="$BATS_TEST_TMPDIR/verdicts.tsv"
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ -z "$output" ]

  export FAKE_REFUSE='*'
  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ -z "$output" ]
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 1 ]
}

@test "probes again on every call when no verdict file is shared" {
  create_registry_stub
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  export FAKE_REFUSE='*'
  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 2 ]
}

@test "escapes the registry's text so it cannot start a workflow command" {
  create_registry_stub
  export FAKE_REFUSE='*' FAKE_REGISTRY_ERROR=$'429 Too Many Requests\n::error::forged\r\n100% refused'
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "${#stderr_lines[@]}" -eq 1 ]
  [[ "$stderr" == *'%0A::error::forged%0D%0A100%25 refused'* ]]
}

@test "treats an unanswered probe as a refusal" {
  create_registry_stub
  export FAKE_REGISTRY_SLEEP=5 PROBE_TIMEOUT=1
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror contexts --probe "$FIXTURE"
  assert_success
  [ "$output" = "$FIXTURE_CONTEXT" ]
  [[ "$stderr" == *'no answer within 1s'* ]]
}

@test "never probes a registry for a ref it refused to parse" {
  create_registry_stub
  set_base_line 'FROM public.ecr.aws/docker/library/node:24 AS base'

  run_mirror contexts --probe "$FIXTURE"
  assert_refused
  [ ! -s "$COMMAND_LOG" ]
}

# --- compose-override -------------------------------------------------------------

# A resolved project: prod and k6 build ECR-based Dockerfiles (k6 by an absolute
# path), playwright builds a non-ECR one, and redis builds nothing.
write_compose_config() {
  local dir="$BATS_TEST_TMPDIR/project"
  mkdir -p "$dir/load"
  printf 'FROM %s AS base\nFROM base AS production\n' "$FIXTURE_REF" >"$dir/Dockerfile"
  printf 'FROM public.ecr.aws/docker/library/golang:1@sha256:%s AS builder\nFROM %s\n' \
    "$OTHER" "$FIXTURE_REF" >"$dir/load/Dockerfile"
  printf 'FROM mcr.microsoft.com/playwright:v1@sha256:%s\n' "$OTHER" >"$dir/Playwright.Dockerfile"
  export FAKE_COMPOSE_CONFIG="$BATS_TEST_TMPDIR/config.json"
  jq -n --arg dir "$dir" '{services: {
    prod: {build: {context: $dir, dockerfile: "Dockerfile", target: "production"}},
    k6: {profiles: ["load"], build: {context: $dir, dockerfile: ($dir + "/load/Dockerfile")}},
    playwright: {build: {context: $dir, dockerfile: "Playwright.Dockerfile"}},
    redis: {image: "redis"}
  }}' >"$FAKE_COMPOSE_CONFIG"
}

@test "compose-override adds additional_contexts to each service that FROMs an ECR base" {
  create_registry_stub
  write_compose_config
  local out="$BATS_TEST_TMPDIR/overrides/test.compose.json"

  run_mirror compose-override "$out" docker-compose.test.yml common-healthchecks.yml
  assert_success
  assert_log_contains "docker compose -f docker-compose.test.yml -f common-healthchecks.yml --profile * config --format json"
  [ "$(jq -r '.services | keys | join(",")' "$out")" = 'k6,prod' ]
  [ "$(jq -r --arg ref "$FIXTURE_REF" '.services.prod.build.additional_contexts[$ref]' "$out")" = "docker-image://mirror.gcr.io/library/node@sha256:$DIGEST" ]
  [ "$(jq -r '.services.k6.build.additional_contexts | length' "$out")" -eq 2 ]
  [ "$(jq -r '.services.prod.build | keys | join(",")' "$out")" = 'additional_contexts' ]
  [ ! -e "$out.tmp" ]
}

@test "compose-override --probe keeps the answered refs on ECR Public" {
  create_registry_stub
  write_compose_config
  export FAKE_REFUSE='*golang*'
  local out="$BATS_TEST_TMPDIR/test.compose.json"

  run_mirror compose-override --probe "$out" docker-compose.test.yml
  assert_success
  [ "$(jq -r '.services | keys | join(",")' "$out")" = 'k6' ]
  [ "$(jq -r '.services.k6.build.additional_contexts | keys | join(",")' "$out")" = "public.ecr.aws/docker/library/golang:1@sha256:$OTHER" ]
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq 2 ]
}

@test "compose-override writes an empty override when ECR Public answers everything" {
  create_registry_stub
  write_compose_config
  local out="$BATS_TEST_TMPDIR/test.compose.json"

  run_mirror compose-override --probe "$out" docker-compose.test.yml
  assert_success
  [ "$(jq -c . "$out")" = '{"services":{}}' ]
}

@test "compose-override fails closed when Compose cannot resolve the project" {
  create_registry_stub
  write_compose_config
  export FAKE_COMPOSE_FAIL=1
  local out="$BATS_TEST_TMPDIR/test.compose.json"

  run_mirror compose-override "$out" docker-compose.test.yml
  assert_refused
  [ ! -e "$out" ]
}

@test "compose-override fails closed on a service whose Dockerfile breaks the contract" {
  create_registry_stub
  write_compose_config
  printf 'FROM public.ecr.aws/docker/library/node:24 AS base\n' >"$BATS_TEST_TMPDIR/project/Dockerfile"
  local out="$BATS_TEST_TMPDIR/test.compose.json"

  run_mirror compose-override "$out" docker-compose.test.yml
  assert_refused
  [ ! -e "$out" ]
}

# --- github-output (the dev-container composite) -------------------------------

@test "github-output appends the refused and the full context lists as multi-line outputs" {
  create_registry_stub
  export FAKE_REFUSE='*node*'
  write_dockerfile "FROM $FIXTURE_REF AS base" \
    "FROM public.ecr.aws/docker/library/alpine:3.21@sha256:$OTHER AS tools"
  local outputs="$BATS_TEST_TMPDIR/github-output"
  printf 'earlier=kept\n' >"$outputs"

  run --separate-stderr env PATH="$STUB_BIN_DIR:$PATH" COMMAND_LOG="$COMMAND_LOG" \
    GITHUB_OUTPUT="$outputs" bash "$PROJECT_ROOT/$SCRIPT_REL" github-output "$FIXTURE"
  assert_success
  [ -z "$output" ]
  mapfile -t written <"$outputs"
  [ "${written[0]}" = 'earlier=kept' ]
  [[ "${written[1]}" == 'build-contexts<<ECR_MIRROR_'* ]]
  [ "${written[2]}" = "$FIXTURE_CONTEXT" ]
  [ "${written[3]}" = "${written[1]#build-contexts<<}" ]
  [[ "${written[4]}" == 'mirror-contexts<<ECR_MIRROR_'* ]]
  [ "${written[5]}" = "$FIXTURE_CONTEXT" ]
  [ "${written[6]}" = "public.ecr.aws/docker/library/alpine:3.21@sha256:$OTHER=docker-image://mirror.gcr.io/library/alpine@sha256:$OTHER" ]
  [ "${written[7]}" = "${written[4]#mirror-contexts<<}" ]
  [ "${#written[@]}" -eq 8 ]
  [ "${written[1]}" != "build-contexts<<${written[4]#mirror-contexts<<}" ]
}

@test "github-output leaves build-contexts empty when ECR Public answers" {
  create_registry_stub
  write_dockerfile "FROM $FIXTURE_REF AS base"

  run_mirror github-output "$FIXTURE"
  assert_success
  [[ "${lines[0]}" == 'build-contexts<<ECR_MIRROR_'* ]]
  [ "${lines[1]}" = "${lines[0]#build-contexts<<}" ]
  [ "${lines[3]}" = "$FIXTURE_CONTEXT" ]
}

# --- Makefile wiring (ECR_MIRROR) ---------------------------------------------------

setup_mirror_makefile() {
  setup_makefile_test_env
  cp "$PROJECT_ROOT/Dockerfile" "$PROJECT_ROOT/docker-compose.test.yml" \
    "$PROJECT_ROOT/docker-compose.memory-leak.yml" "$PROJECT_ROOT/common-healthchecks.yml" \
    "$MAKEFILE_SANDBOX/"
  export ECR_MIRROR_DIR="$BATS_TEST_TMPDIR/ecr-mirror"
  export FAKE_COMPOSE_CONFIG="$BATS_TEST_TMPDIR/config.json"
  jq -n --arg dir "$MAKEFILE_SANDBOX" \
    '{services: {prod: {build: {context: $dir, dockerfile: "Dockerfile"}}}}' >"$FAKE_COMPOSE_CONFIG"
}

@test "ECR_MIRROR defaults to off and leaves every build command line untouched" {
  setup_mirror_makefile

  run_make_target start-prod
  assert_success
  assert_log_contains 'docker compose -f common-healthchecks.yml -f docker-compose.test.yml up -d'
  run grep -c 'config --format json\|imagetools\|build-context\|ecr-mirror' "$COMMAND_LOG"
  [ "$output" = 0 ]
  [ ! -e "$ECR_MIRROR_DIR" ]
}

@test "ECR_MIRROR=off keeps test-memory-leak's recursive make line exactly as it was" {
  setup_mirror_makefile

  run_make_target test-memory-leak
  assert_success
  printf '%s\n' "${lines[@]}" | grep -qx 'make ci-test-memory-leak'
  refute_output_contains 'ECR_MIRROR_KEEP_VERDICTS'
  assert_log_contains 'docker compose -p memleak -f docker-compose.memory-leak.yml up -d --wait --build'
  ! grep -q 'imagetools' "$COMMAND_LOG"
}

@test "ECR_MIRROR=probe hands test-memory-leak's recursive make the verdicts" {
  setup_mirror_makefile

  run_make_target test-memory-leak ECR_MIRROR=probe ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  printf '%s\n' "${lines[@]}" | grep -qx 'make ci-test-memory-leak ECR_MIRROR_KEEP_VERDICTS=1'
}

@test "ECR_MIRROR=always redirects start-prod, build-out and the memory-leak stack" {
  setup_mirror_makefile
  local override="$ECR_MIRROR_DIR/test.compose.json"

  run_make_target start-prod ECR_MIRROR=always ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  assert_log_contains "docker compose -f common-healthchecks.yml -f docker-compose.test.yml -f $override up -d"
  [ "$(jq -r '.services.prod.build.additional_contexts | keys[0]' "$override")" = "$(sed -nE 's/^FROM ([^ ]+) AS base$/\1/p' "$PROJECT_ROOT/Dockerfile")" ]
  ! grep -q 'imagetools' "$COMMAND_LOG"

  # Each target must write its own override, not reuse the previous target's.
  rm -rf "$ECR_MIRROR_DIR"
  reset_command_log
  run_make_target build-out ECR_MIRROR=always ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  assert_log_contains "docker build -t next-build -f Dockerfile --target production --build-context=$(head -n1 "$ECR_MIRROR_DIR/Dockerfile.contexts") --build-arg"

  rm -rf "$ECR_MIRROR_DIR"
  reset_command_log
  run_make_target ci-test-memory-leak ECR_MIRROR=always ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  assert_log_contains "docker compose -p memleak -f docker-compose.memory-leak.yml -f $ECR_MIRROR_DIR/memory-leak.compose.json up -d --wait --build"
}

@test "ECR_MIRROR=probe asks ECR Public before building" {
  setup_mirror_makefile

  run_make_target build-out ECR_MIRROR=probe ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  assert_log_contains 'docker buildx imagetools inspect --raw public.ecr.aws/docker/library/'
  assert_log_contains 'docker build -t next-build -f Dockerfile --target production --build-arg'
  [ ! -s "$ECR_MIRROR_DIR/Dockerfile.contexts" ]
}

@test "ECR_MIRROR=probe asks once per ref across all three artifacts, and test-memory-leak once in all" {
  setup_mirror_makefile
  local refs
  refs="$(sed -nE 's#^FROM (public\.ecr\.aws/docker/library/[^ ]+).*#\1#p' "$PROJECT_ROOT/Dockerfile" | sort -u | wc -l)"

  run_make_target ecr-mirror-overrides ECR_MIRROR=probe ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq "$refs" ]

  reset_command_log
  run_make_target ecr-mirror-overrides ECR_MIRROR=probe ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq "$refs" ]

  rm -rf "$ECR_MIRROR_DIR"
  reset_command_log
  run_make_target test-memory-leak ECR_MIRROR=probe ECR_MIRROR_DIR="$ECR_MIRROR_DIR"
  assert_success
  assert_log_contains "docker compose -p memleak -f docker-compose.memory-leak.yml -f $ECR_MIRROR_DIR/memory-leak.compose.json up -d --wait --build"
  [ "$(grep -c 'imagetools inspect' "$COMMAND_LOG")" -eq "$refs" ]
}

@test "ecr-mirror-overrides refuses to run with ECR_MIRROR=off" {
  setup_mirror_makefile

  run_make_target ecr-mirror-overrides
  [ "$status" -ne 0 ]
  assert_output_contains 'set ECR_MIRROR=probe or ECR_MIRROR=always'
}

@test "an unknown ECR_MIRROR value is a hard error" {
  setup_mirror_makefile

  run_make_target start-prod ECR_MIRROR=yes
  [ "$status" -ne 0 ]
  assert_output_contains "ECR_MIRROR must be 'off', 'probe' or 'always' (got 'yes')"
}
