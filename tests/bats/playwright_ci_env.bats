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
#
# A `//` only opens a comment when it is not inside a string literal. Cutting every
# line at its first `//` truncated
# `const BASE_URL: string = … || 'http://prod:3001';` to `… || 'http:`, silently
# changing what the assertions below were reading. The scan tracks '…', "…" and `…`
# (honouring backslash escapes) and cuts only at a `//` found outside all three, so a
# whole-line comment still disappears and a URL in a string still survives.
playwright_config_code() {
  awk '
    function strip_comment(s,   i, n, c, quote) {
      n = length(s)
      quote = ""
      for (i = 1; i <= n; i++) {
        c = substr(s, i, 1)
        if (quote != "") {
          if (c == "\\") i++
          else if (c == quote) quote = ""
          continue
        }
        if (c == "\"" || c == "'\''" || c == "`") { quote = c; continue }
        if (c == "/" && substr(s, i + 1, 1) == "/") return substr(s, 1, i - 1)
      }
      return s
    }
    {
      line = strip_comment($0)
      if (line !~ /^[[:space:]]*$/) print line
    }
  ' "$PROJECT_ROOT/$PLAYWRIGHT_CONFIG"
}

# Print the `actions/upload-artifact` step blocks of a workflow, one per line, with the
# step's own lines joined by ";" so a single grep can require two keys of the same step.
#
# `path:` is normalized into one `path-entry: <value>` token per uploaded path, because
# a workflow may spell the same upload either way:
#
#   path: playwright-report/        path: |
#                                     playwright-report/
#                                     test-results/results.json
#
# The block form's lines are literal scalar content, not YAML keys, so they are folded
# into the step that opened them and never read as structure — which also stops a `run: |`
# script containing a `- ` line from being mistaken for the start of a new step.
upload_artifact_steps() {
  awk '
    function close_step() {
      if (in_step && is_upload && block != "") print block
      in_step = 0; is_upload = 0; block = ""
      in_block = 0; path_block = 0
    }
    function append(token) {
      block = (block == "" ? token : block ";" token)
    }
    function unquote(v) {
      if (v ~ /^".*"$/ || v ~ /^'\''.*'\''$/) v = substr(v, 2, length(v) - 2)
      return v
    }
    {
      raw = $0

      # Lines indented under a `key: |` / `key: >` header are literal scalar text, not
      # YAML structure. Only a `path:` block contributes, one entry per line; anything
      # else — a `run:` script whose shell happens to contain `- ` or `if: always()` —
      # is skipped, so it can neither open a step nor be credited to one.
      if (in_block) {
        if (raw ~ /^[[:space:]]*$/) next
        if (match(raw, /[^[:space:]]/) - 1 > block_indent) {
          if (in_step && path_block) {
            entry = raw
            gsub(/^[[:space:]]+|[[:space:]]+$/, "", entry)
            sub(/^-[[:space:]]+/, "", entry)
            if (entry != "" && entry !~ /^#/) append("path-entry: " unquote(entry))
          }
          next
        }
        in_block = 0; path_block = 0
      }

      line = raw
      sub(/[[:space:]]+#.*$/, "", line)
      if (line ~ /^[[:space:]]*#/) next
      if (line ~ /^[[:space:]]*$/) next

      first = match(line, /[^[:space:]]/)
      indent = first - 1

      # A step ends at the next `- ` item at its own indent, or at any line that dedents
      # out of the sequence entirely (the next job, say) — without the second rule a step
      # would absorb the lines that follow its list and could be credited with their keys.
      if (in_step && indent <= step_indent) close_step()
      if (!in_step && substr(line, first, 2) == "- ") {
        in_step = 1
        step_indent = indent
      }

      # The mapping key on this line, with any sequence dash removed, and the column it
      # really starts at: in `- path: x` the key is nested one level below the dash.
      key = substr(line, first)
      key_indent = indent
      if (substr(line, first, 2) == "- ") {
        off = match(substr(line, first + 1), /[^[:space:]]/)
        key = substr(line, first + off)
        key_indent = first + off - 1
      }

      if (in_step && key ~ /^uses:[[:space:]]*["'\'']?actions\/upload-artifact@/) is_upload = 1

      if (key ~ /^path:/) {
        value = key
        sub(/^path:[[:space:]]*/, "", value)
        sub(/[[:space:]]+$/, "", value)
        if (value ~ /^[|>][-+0-9]*$/) {
          in_block = 1; block_indent = key_indent; path_block = 1
        } else if (in_step && value != "") {
          append("path-entry: " unquote(value))
        }
      } else if (key ~ /:[[:space:]]*[|>][-+0-9]*[[:space:]]*$/) {
        in_block = 1; block_indent = key_indent; path_block = 0
      }

      gsub(/^[[:space:]]+|[[:space:]]+$/, "", line)
      if (in_step) append(line)
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
    # a path of `playwright-report/` on another would leave failures unpublished. The
    # path is read through the helper's normalized `path-entry:` token, so the scalar
    # form (visual-testing.yml) and the block list the flake gate added to
    # e2e-testing.yml are both accepted — and neither is satisfied by a report path that
    # no longer includes `playwright-report/`.
    printf '%s\n' "$output" |
      grep -F 'path-entry: playwright-report/' |
      grep -qF 'if: always()'
  done
}

@test "the report keys must belong to one step, in either path spelling" {
  local fixture="$BATS_TEST_TMPDIR/workflow.yml"

  # Same two keys, different steps: the guarded upload publishes something else, and a
  # failing run still leaves the report behind.
  cat >"$fixture" <<'EOF'
jobs:
  e2e:
    steps:
      - name: Upload Playwright report
        uses: actions/upload-artifact@043fb46d
        with:
          path: |
            playwright-report/
            test-results/results.json
      - name: Upload coverage
        uses: actions/upload-artifact@043fb46d
        if: always()
        with:
          path: coverage/
EOF

  run upload_artifact_steps "$fixture"
  [ "$status" -eq 0 ]
  ! printf '%s\n' "$output" |
    grep -F 'path-entry: playwright-report/' |
    grep -qF 'if: always()'

  # A `run:` script that merely prints a compliant step is literal text, not a step.
  cat >"$fixture" <<'EOF'
jobs:
  e2e:
    steps:
      - name: Describe the upload we are supposed to have
        run: |
          echo "- uses: actions/upload-artifact@043fb46d"
          echo "  if: always()"
          echo "  with:"
          echo "    path: playwright-report/"
EOF

  run upload_artifact_steps "$fixture"
  [ "$status" -eq 0 ]
  ! printf '%s\n' "$output" |
    grep -F 'path-entry: playwright-report/' |
    grep -qF 'if: always()'
}

@test "the comment stripper does not truncate code at a \"//\" inside a string" {
  run playwright_config_code
  [ "$status" -eq 0 ]

  # A URL in a string literal survives whole; stripping every `//` turned this into
  # `const BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL || 'http:`.
  assert_output_contains "'http://prod:3001'"

  # …while the prose that quotes the settings this suite pins is still removed, so a
  # deleted setting cannot be matched by the comment describing it.
  ! printf '%s\n' "$output" | grep -qF 'dead config while retries were 0'
}
