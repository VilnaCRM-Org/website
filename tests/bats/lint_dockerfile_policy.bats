#!/usr/bin/env bats
#
# Coverage for scripts/ci/lint-dockerfile-policy.sh — the registry + digest-pin
# policy gate (issue #370). Exercises the parser's edge cases directly against
# throwaway Dockerfile fixtures so a regression in the policy logic is caught
# without a container build.

load './test_helper.bash'

setup() {
  LINTER="$PROJECT_ROOT/scripts/ci/lint-dockerfile-policy.sh"
  FIXTURE="$BATS_TEST_TMPDIR/Dockerfile.fixture"
  # A concrete 64-char lowercase hex digest for the compliant fixtures.
  HEX64="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
}

# Write $2.. as the fixture body (each arg is one line).
write_fixture() {
  printf '%s\n' "$@" > "$FIXTURE"
}

lint_fixture() {
  run bash "$LINTER" "$FIXTURE"
}

# --- the real repository must satisfy its own policy -----------------------

@test "every tracked Dockerfile in the repo passes the policy" {
  run bash "$LINTER"
  [ "$status" -eq 0 ]
}

# --- compliant references pass ---------------------------------------------

@test "an explicit-registry, digest-pinned image passes" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24.18.0-alpine3.23@sha256:$HEX64"
  lint_fixture
  [ "$status" -eq 0 ]
}

@test "scratch, --platform flags, and lowercase from/as are accepted" {
  write_fixture \
    "FROM --platform=linux/amd64 public.ecr.aws/docker/library/golang:1.24@sha256:$HEX64 AS build" \
    "from build as final" \
    "FROM scratch"
  lint_fixture
  [ "$status" -eq 0 ]
}

@test "a single-label registry host with a port is treated as an explicit registry" {
  write_fixture "FROM registry.internal:5000/app@sha256:$HEX64"
  lint_fixture
  [ "$status" -eq 0 ]
  write_fixture "FROM myregistry:5000/team/app@sha256:$HEX64"
  lint_fixture
  [ "$status" -eq 0 ]
}

# --- multi-line FROM continuations -----------------------------------------

@test "a compliant multi-line FROM is folded and accepted" {
  write_fixture \
    "FROM \\" \
    "  public.ecr.aws/docker/library/node:24@sha256:$HEX64 \\" \
    "  AS base" \
    "FROM base"
  lint_fixture
  [ "$status" -eq 0 ]
}

@test "a non-compliant multi-line FROM is still rejected" {
  write_fixture \
    "FROM \\" \
    "  node:23-alpine"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"Docker Hub is forbidden"* ]]
}

@test "a trailing-backslash comment does not swallow a following FROM" {
  write_fixture \
    "# a comment ending in a backslash \\" \
    "FROM node:23"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"Docker Hub is forbidden"* ]]
}

# --- Docker Hub is forbidden (explicit and implicit) -----------------------

@test "an implicit Docker Hub library image is rejected" {
  write_fixture "FROM node:23-alpine"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"Docker Hub is forbidden"* ]]
}

@test "an explicit docker.io reference is rejected even when digest-pinned" {
  write_fixture "FROM docker.io/library/node:24@sha256:$HEX64"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"Docker Hub is forbidden"* ]]
}

@test "a single-label user/image reference is rejected as implicit Docker Hub" {
  write_fixture "FROM library/node@sha256:$HEX64"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"Docker Hub is forbidden"* ]]
}

# --- digest pinning must be a concrete 64-char hex value -------------------

@test "an unpinned explicit-registry image is rejected" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"must be digest-pinned"* ]]
}

@test "an empty @sha256 suffix is rejected" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24@sha256:"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "a variable-valued @sha256 suffix is rejected" {
  write_fixture 'FROM public.ecr.aws/docker/library/node:24@sha256:${DIGEST}'
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "a short/malformed @sha256 digest is rejected" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24@sha256:abc123"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "a wrong-length all-hex @sha256 digest is rejected" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24@sha256:${HEX64}ab"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}

@test "an uppercase-hex @sha256 digest is rejected" {
  write_fixture "FROM public.ecr.aws/docker/library/node:24@sha256:DEADBEEFdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"
  lint_fixture
  [ "$status" -eq 1 ]
  [[ "$output" == *"64 lowercase hex"* ]]
}
