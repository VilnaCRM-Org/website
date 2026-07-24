#!/usr/bin/env bats

load './test_helper.bash'

# Static contract for the Git hooks that gate local commits and pushes. The
# combined pre-commit + pre-push surface must be a strict superset of the
# previous pre-commit (format, lint-next, lint-tsc, lint-md, test-unit-all).

PRE_COMMIT="$PROJECT_ROOT/.husky/pre-commit"
PRE_PUSH="$PROJECT_ROOT/.husky/pre-push"

@test "pre-commit hook exists and is executable" {
  [ -f "$PRE_COMMIT" ]
  [ -x "$PRE_COMMIT" ]
}

@test "pre-push hook exists and is executable" {
  [ -f "$PRE_PUSH" ]
  [ -x "$PRE_PUSH" ]
}

@test "pre-commit runs lint-staged for a fast staged-file scope" {
  run grep -F 'lint-staged' "$PRE_COMMIT"
  [ "$status" -eq 0 ]
}

@test "pre-commit runs the whole-project type check" {
  run grep -E 'make[[:space:]]+lint-tsc' "$PRE_COMMIT"
  [ "$status" -eq 0 ]
}

@test "pre-push runs format, full lint, and unit suites" {
  run grep -E 'make[[:space:]]+format' "$PRE_PUSH"
  [ "$status" -eq 0 ]
  run grep -E 'make[[:space:]]+lint( |$)' "$PRE_PUSH"
  [ "$status" -eq 0 ]
  run grep -E 'make[[:space:]]+test-unit-all' "$PRE_PUSH"
  [ "$status" -eq 0 ]
}

@test "both hooks use the CI=1 host fallback so they work without Docker" {
  run grep -F 'CI=1' "$PRE_COMMIT"
  [ "$status" -eq 0 ]
  run grep -F 'CI=1' "$PRE_PUSH"
  [ "$status" -eq 0 ]
}

@test "hooks abort on the first failing command" {
  run grep -E '^set -e' "$PRE_COMMIT"
  [ "$status" -eq 0 ]
  run grep -E '^set -e' "$PRE_PUSH"
  [ "$status" -eq 0 ]
}

@test "combined hook surface is a superset of the previous pre-commit gates" {
  # Previous pre-commit ran: format, lint-next, lint-tsc, lint-md, test-unit-all.
  # pre-commit now covers lint-tsc; pre-push's `make lint` covers lint-next and
  # lint-md, `make format` covers format, and test-unit-all is explicit.
  local combined
  combined="$(cat "$PRE_COMMIT" "$PRE_PUSH")"
  echo "$combined" | grep -E 'make[[:space:]]+format'
  echo "$combined" | grep -E 'make[[:space:]]+lint( |$)'
  echo "$combined" | grep -E 'make[[:space:]]+lint-tsc'
  echo "$combined" | grep -E 'make[[:space:]]+test-unit-all'
}
