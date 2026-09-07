#!/usr/bin/env bats

# Regression gate for issue #374 (F3): the agent-steering files — the docs and
# scripts AI agents are contractually required to read and follow — must keep
# CODEOWNERS coverage so an edit to agent-executable instructions can never
# merge without maintainer review.
#
# Extended by issue #344 with the second class of file that needs a human in the
# loop: the artefacts a merged mistake makes unfalsifiable (an approved visual
# baseline certifies itself) and the gate configs whose quiet weakening is the
# easiest way to turn a red check green.

load './test_helper.bash'

CODEOWNERS_FILE="$PROJECT_ROOT/.github/CODEOWNERS"

@test "CODEOWNERS exists in .github" {
  [ -f "$CODEOWNERS_FILE" ]
}

@test "every agent-steering path keeps CODEOWNERS coverage with an owner" {
  local paths=(
    '/CLAUDE.md'
    '/agents.md'
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

@test "every approved-by-definition artefact and gate config keeps CODEOWNERS coverage" {
  local paths=(
    '/src/test/visual/*-snapshots/'
    '/src/test/visual/**/*-snapshots/'
    '/.github/workflows/'
    '/scripts/ci/'
    '/scripts/cloudfront_routing.js'
    '/scripts/cloudfront_security_headers.js'
    '/tsconfig.json'
    '/eslint.config.mjs'
    '/jest.config.ts'
    '/stryker.config.mjs'
    '/playwright.config.ts'
    '/.dependency-cruiser.js'
    '/config/'
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

@test "every owned path that names a file still exists" {
  # A CODEOWNERS entry for a path that has been renamed or deleted is coverage
  # that silently stopped applying — the file it guarded now merges unreviewed
  # under its new name. Directory and glob patterns are checked by expansion, so
  # a snapshot directory that moves is caught too.
  local pattern owner target

  while read -r pattern owner; do
    case "$pattern" in
      ''|'#'*) continue ;;
    esac
    [ -n "$owner" ] || continue

    # CODEOWNERS patterns are repo-root-anchored when they start with `/`.
    target="$PROJECT_ROOT/${pattern#/}"

    # globstar is what makes `**` mean "any number of directories, including
    # none" — without it bash treats `**` as a single `*` and the deeper
    # snapshot directory would never be reached, so the assertion would pass
    # for the wrong reason.
    if [[ "$pattern" == *'*'* ]]; then
      shopt -s globstar
      compgen -G "$target" > /dev/null || {
        echo "CODEOWNERS pattern matches nothing in the tree: $pattern" >&2
        shopt -u globstar
        return 1
      }
      shopt -u globstar
      continue
    fi

    if [ ! -e "${target%/}" ]; then
      echo "CODEOWNERS owns a path that no longer exists: $pattern" >&2
      return 1
    fi
  done < "$CODEOWNERS_FILE"
}
