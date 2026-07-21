#!/usr/bin/env bats

# Typed config layer (#328): guard the production env surface so no dev
# placeholder can bake into the static export, and keep .env.example in sync with
# the Zod schema in src/config/env.ts.

load './test_helper.bash'

# Dev placeholders that must never reach the production bundle.
FORBIDDEN_PATTERN='localhost:4000|yourserver\.io|G-XYZ'

@test ".env.production is free of dev placeholders (localhost:4000 / yourserver.io / G-XYZ)" {
  local env_prod="$PROJECT_ROOT/.env.production"
  [ -f "$env_prod" ]

  run grep -nE "$FORBIDDEN_PATTERN" "$env_prod"
  [ "$status" -ne 0 ]
}

@test ".env.production defines the production API endpoints the bundle consumes" {
  local env_prod="$PROJECT_ROOT/.env.production"
  [ -f "$env_prod" ]

  run grep -E '^NEXT_PUBLIC_GRAPHQL_API_URL=https://' "$env_prod"
  [ "$status" -eq 0 ]
  run grep -E '^NEXT_PUBLIC_API_URL=https://' "$env_prod"
  [ "$status" -eq 0 ]
}

@test ".env.example documents every NEXT_PUBLIC_ variable validated by the env schema" {
  local example="$PROJECT_ROOT/.env.example"
  local schema="$PROJECT_ROOT/src/config/env.ts"
  [ -f "$example" ]
  [ -f "$schema" ]

  local missing=0
  local key
  # Schema keys are the `NEXT_PUBLIC_*:` object properties (the trailing colon
  # excludes the `process.env.NEXT_PUBLIC_X` reference in the doc comment).
  while IFS= read -r key; do
    if ! grep -qE "^${key}=" "$example"; then
      echo "Missing from .env.example: $key" >&2
      missing=1
    fi
  done < <(grep -oE 'NEXT_PUBLIC_[A-Z0-9_]+:' "$schema" | tr -d ':' | sort -u)

  [ "$missing" -eq 0 ]
}

@test "the production export (out/) contains no dev placeholders when present" {
  local out_dir="$PROJECT_ROOT/out"
  if [ ! -d "$out_dir" ]; then
    skip "out/ is not built in this environment; run 'make build-out' to produce it"
  fi

  run grep -rE "$FORBIDDEN_PATTERN" "$out_dir"
  [ "$status" -ne 0 ]
}
