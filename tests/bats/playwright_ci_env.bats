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

load './test_helper.bash'

COMPOSE_FILE='docker-compose.test.yml'
PLAYWRIGHT_CONFIG='playwright.config.ts'

# Print the `playwright:` service block from the compose file: every line from the
# service key up to (but excluding) the next service key at the same indent.
playwright_service_block() {
  awk '
    /^  playwright:[[:space:]]*$/ { inside = 1; next }
    inside && /^  [^[:space:]#]/  { inside = 0 }
    inside                        { print }
  ' "$PROJECT_ROOT/$COMPOSE_FILE"
}

@test "the playwright service receives CI from the environment it was started in" {
  run playwright_service_block
  [ "$status" -eq 0 ]
  [ -n "$output" ]
  assert_output_contains 'CI=${CI:-}'
}

@test "playwright.config.ts gates retries, workers and forbidOnly on CI" {
  local config="$PROJECT_ROOT/$PLAYWRIGHT_CONFIG"
  [ -f "$config" ]

  run grep -E 'retries:[[:space:]]*process\.env\.CI[[:space:]]*\?' "$config"
  [ "$status" -eq 0 ]

  run grep -E 'forbidOnly:[[:space:]]*!!process\.env\.CI' "$config"
  [ "$status" -eq 0 ]

  run grep -E 'process\.env\.CI[[:space:]]*\?[[:space:]]*\{[[:space:]]*workers:' "$config"
  [ "$status" -eq 0 ]
}

@test "retries stay above zero in CI so the on-first-retry trace can be captured" {
  local config="$PROJECT_ROOT/$PLAYWRIGHT_CONFIG"

  run grep -E "trace:[[:space:]]*'on-first-retry'" "$config"
  [ "$status" -eq 0 ]

  # `retries: process.env.CI ? <n> : 0` — <n> must be at least 1, or the trace
  # setting above is unreachable again.
  local ci_retries
  ci_retries="$(sed -n "s/.*retries:[[:space:]]*process\.env\.CI[[:space:]]*?[[:space:]]*\([0-9]\+\).*/\1/p" "$config")"
  [ -n "$ci_retries" ]
  [ "$ci_retries" -ge 1 ]
}

@test "the e2e and visual workflows publish the Playwright report that carries the traces" {
  local workflow
  for workflow in e2e-testing.yml visual-testing.yml; do
    run grep -F 'path: playwright-report/' "$PROJECT_ROOT/.github/workflows/$workflow"
    [ "$status" -eq 0 ]
    run grep -F 'if: always()' "$PROJECT_ROOT/.github/workflows/$workflow"
    [ "$status" -eq 0 ]
  done
}
