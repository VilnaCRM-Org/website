#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-node-version-sources.sh (issue #335) -- the gate
# behind `make lint-node-version`. It is the only thing standing between the repo
# and four independently editable Node version sources drifting apart, so every
# drift it claims to catch is pinned here, alongside the happy path and the
# vacuity guards that stop the gate from passing when it inspected nothing.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-node-version-sources.sh'

NVMRC_VERSION='24.18.0'

# Build a fixture repository under $1 whose four Node version sources all agree.
make_consistent_repo() {
  local dir="$1"

  mkdir -p "$dir/.github/workflows"

  printf '%s\n' "$NVMRC_VERSION" >"$dir/.nvmrc"

  cat >"$dir/Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
FROM base AS build
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS production
EOF

  cat >"$dir/Apollo.Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
EOF

  cat >"$dir/package.json" <<EOF
{
  "name": "fixture",
  "engines": {
    "node": "^${NVMRC_VERSION}",
    "bun": ">=1.3.5"
  }
}
EOF

  cat >"$dir/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
EOF
}

run_checker() {
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$1"
}

setup() {
  REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
}

@test "passes when every Node version source agrees" {
  make_consistent_repo "$REPO"

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
  assert_output_contains "$NVMRC_VERSION"
}

@test "passes against the real repository" {
  run_checker "$PROJECT_ROOT"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "fails when a Dockerfile base image drifts from .nvmrc" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Apollo.Dockerfile" <<'EOF'
FROM public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'Apollo.Dockerfile pins node:23.11.1'
  assert_output_contains "$NVMRC_VERSION"
}

@test "fails when only the second stage of a Dockerfile drifts" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
FROM public.ecr.aws/docker/library/node:24.17.0-alpine3.23 AS production
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins node:24.17.0'
}

@test "fails when package.json engines.node only admits the pin instead of pinning it" {
  make_consistent_repo "$REPO"
  cat >"$REPO/package.json" <<'EOF'
{
  "name": "fixture",
  "engines": {
    "node": "^24",
    "bun": ">=1.3.5"
  }
}
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "engines.node is '^24'"
  assert_output_contains "expected '^${NVMRC_VERSION}'"
}

@test "fails when a setup-node step does not read .nvmrc" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24.18.0
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'actions/setup-node'
  assert_output_contains "node-version-file: '.nvmrc'"
}

@test "fails when a workflow reintroduces vars.NODE_VERSION" {
  make_consistent_repo "$REPO"
  cat >>"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
      - name: Legacy setup
        run: echo "${{ vars.NODE_VERSION }}"
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'vars.NODE_VERSION'
}

@test "aborts when .nvmrc is missing" {
  make_consistent_repo "$REPO"
  rm "$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains '.nvmrc is missing'
}

@test "aborts when .nvmrc does not pin an exact version" {
  make_consistent_repo "$REPO"
  printf '24\n' >"$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'exact MAJOR.MINOR.PATCH'
}

@test "aborts rather than passing vacuously when no Node base image is found" {
  make_consistent_repo "$REPO"
  rm "$REPO/Dockerfile" "$REPO/Apollo.Dockerfile"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'would pass vacuously'
}

@test "aborts when package.json declares no engines.node" {
  make_consistent_repo "$REPO"
  printf '{ "name": "fixture" }\n' >"$REPO/package.json"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'no engines.node'
}

@test "ignores an image whose name merely ends in node" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Mockoon.Dockerfile" <<'EOF'
FROM ghcr.io/example/mynode:1.2.3 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}
