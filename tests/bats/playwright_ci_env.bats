#!/usr/bin/env bats
#
# The Playwright CI contract (issue #335).
#
# Playwright never runs on the runner itself — `make test-e2e` / `make test-visual`
# shell into the `playwright` service — so every `process.env.CI` branch in
# playwright.config.ts is only live if the compose file hands `CI` to that
# container. It did not, which is why `trace: 'on-first-retry'` had still never
# produced a trace even after `retries` was configured: the retry it waits for
# could not happen. These assertions pin both halves of that contract together,
# because either one alone is silently inert.
#
# Every assertion below reads *active* configuration: comments are stripped before
# matching, so the prose in playwright.config.ts that quotes `trace: 'on-first-retry'`
# cannot stand in for the setting itself, and the artifact assertions are scoped to a
# single upload step rather than to the file as a whole.
#
# These are text assertions on purpose, and they do pin the single-line shape of the
# settings they name: hoisting `retries: process.env.CI ? 2 : 0` into a variable or
# splitting it across lines will fail this suite even though the behaviour is intact.
# That is the cheap trade. The alternative — importing playwright.config.ts to inspect
# the resolved object — cannot see the bug this file exists for, because the config
# resolves identically in both worlds; only the container's environment differs. When a
# refactor legitimately changes the shape, update the pattern here in the same commit.

load './test_helper.bash'

COMPOSE_FILE='docker-compose.test.yml'
PLAYWRIGHT_CONFIG='playwright.config.ts'

# Print the `playwright:` service block from the compose file with comments removed:
# every line from the service key up to (but excluding) the next key at the same indent.
playwright_service_block() {
  awk '
    /^  playwright:[[:space:]]*$/ { inside = 1; next }
    inside && /^  [^[:space:]#]/  { inside = 0 }
    inside {
      line = $0
      sub(/[[:space:]]*#.*$/, "", line)
      if (line !~ /^[[:space:]]*$/) print line
    }
  ' "$PROJECT_ROOT/$COMPOSE_FILE"
}

# Print playwright.config.ts with `//` line comments and blank lines removed.
playwright_config_code() {
  awk '
    {
      line = $0
      sub(/[[:space:]]*\/\/.*$/, "", line)
      if (line !~ /^[[:space:]]*$/) print line
    }
  ' "$PROJECT_ROOT/$PLAYWRIGHT_CONFIG"
}

# Print the `actions/upload-artifact` step blocks of a workflow, one per line, with the
# step's own lines joined by ";" so a single grep can require two keys of the same step.
upload_artifact_steps() {
  awk '
    function close_step() {
      if (in_step && is_upload && block != "") print block
      in_step = 0; is_upload = 0; block = ""
    }
    {
      line = $0
      sub(/[[:space:]]+#.*$/, "", line)
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*$/) next

      first = match(line, /[^[:space:]]/)
      indent = first - 1

      if (substr(line, first, 2) == "- ") {
        if (!in_step || indent <= step_indent) {
          close_step()
          in_step = 1
          step_indent = indent
        }
      }

      if (line ~ /uses:[[:space:]]*["'\'']?actions\/upload-artifact@/) is_upload = 1

      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      block = (block == "" ? line : block ";" line)
    }
    END { close_step() }
  ' "$1"
}

@test "the playwright service receives CI from the environment it was started in" {
  run playwright_service_block
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  assert_output_contains '- CI=${CI:-}'
}

@test "playwright.config.ts gates retries, workers and forbidOnly on CI" {
  run playwright_config_code
  [ "$status" -eq 0 ]

  printf '%s\n' "$output" | grep -qE '^[[:space:]]*retries:[[:space:]]*process\.env\.CI[[:space:]]*\?'
  printf '%s\n' "$output" | grep -qE '^[[:space:]]*forbidOnly:[[:space:]]*!!process\.env\.CI'
  printf '%s\n' "$output" | grep -qE 'process\.env\.CI[[:space:]]*\?[[:space:]]*\{[[:space:]]*workers:'
}

@test "retries stay above zero in CI so the on-first-retry trace can be captured" {
  local code
  code="$(playwright_config_code)"

  printf '%s\n' "$code" | grep -qE "^[[:space:]]*trace:[[:space:]]*'on-first-retry'"

  # `retries: process.env.CI ? <n> : 0` — <n> must be at least 1, or the trace
  # setting above is unreachable again.
  local ci_retries
  ci_retries="$(
    printf '%s\n' "$code" |
      sed -n "s/^[[:space:]]*retries:[[:space:]]*process\.env\.CI[[:space:]]*?[[:space:]]*\([0-9]\+\).*/\1/p"
  )"
  [ -n "$ci_retries" ]
  [ "$ci_retries" -ge 1 ]
}

@test "the e2e and visual workflows publish the Playwright report on failure" {
  local workflow
  for workflow in e2e-testing.yml visual-testing.yml; do
    run upload_artifact_steps "$PROJECT_ROOT/.github/workflows/$workflow"
    [ "$status" -eq 0 ]
    [ -n "$output" ]

    # Both keys must belong to the SAME upload step: an `if: always()` on one step and
    # a `path: playwright-report/` on another would leave failures unpublished.
    printf '%s\n' "$output" |
      grep -F 'path: playwright-report/' |
      grep -qF 'if: always()'
  done
}
