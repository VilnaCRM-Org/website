#!/usr/bin/env bats

# Regression gate for issue #374 (F3): the agent-steering files — the docs and
# scripts AI agents are contractually required to read and follow — must keep
# CODEOWNERS coverage so an edit to agent-executable instructions can never
# merge without maintainer review.

load './test_helper.bash'

CODEOWNERS_FILE="$PROJECT_ROOT/.github/CODEOWNERS"

@test "CODEOWNERS exists in .github" {
  [ -f "$CODEOWNERS_FILE" ]
}

@test "every agent-steering path keeps CODEOWNERS coverage with an owner" {
  local paths=(
    '/CLAUDE.md'
    '/AGENTS.md'
    '/cursor-project-guide.md'
    '/.claude/'
    '/scripts/get-pr-comments.sh'
    '/.github/CODEOWNERS'
  )

  local path
  for path in "${paths[@]}"; do
    if ! awk -v p="$path" '$1 == p && $2 ~ /^@/ { found = 1 } END { exit found ? 0 : 1 }' \
      "$CODEOWNERS_FILE"; then
      echo "Missing CODEOWNERS coverage (pattern + @owner) for: $path" >&2
      return 1
    fi
  done
}
