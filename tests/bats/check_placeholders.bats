#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-placeholders.sh and `make lint-placeholders`
# (issue #327) -- the gate that keeps template placeholder tokens out of the
# shipped sources, the env files and the README.
#
# Every fixture tree is assembled at runtime under $BATS_TEST_TMPDIR, and each
# token is written into it by a test rather than committed as a fixture file:
# the proof that the gate fires must never itself be a file the gate could
# report. The token spellings ARE literal in this file on purpose -- reading
# them back from the script's own list would make the suite tautological, so a
# token silently dropped from the script would still pass here.
#
# A gate that only ever passes is not a gate: beside the clean-tree case, every
# token is proved to turn the run red, and so are the three fail-closed paths
# (a missing scan root, an empty scan set, and the Make recipe propagating the
# script's exit status).

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-placeholders.sh'

# The default scan set the script reads from the repository root.
DEFAULT_ROOTS='src pages public .env .env.example .env.production README.md'

# A clean tree shaped like the real scan set, with content that is close to a
# token without being one, so a scan that matched too loosely would show up
# here as a false red.
assemble_clean_fixture() {
  FIXTURE="$BATS_TEST_TMPDIR/tree"
  mkdir -p "$FIXTURE/src/features/landing" "$FIXTURE/src/test" "$FIXTURE/pages" \
    "$FIXTURE/public/.well-known"
  printf 'export const origin = "https://api.vilnacrm.com";\n' >"$FIXTURE/src/features/landing/api.ts"
  printf 'export default function Home() { return null; }\n' >"$FIXTURE/pages/index.tsx"
  printf 'Sitemap: https://vilnacrm.com/sitemap.xml\n' >"$FIXTURE/public/robots.txt"
  printf 'Contact: mailto:info@vilnacrm.com\n' >"$FIXTURE/public/.well-known/security.txt"
  printf 'NEXT_PUBLIC_API_URL=https://api.vilnacrm.com\n' >"$FIXTURE/.env"
  printf 'NEXT_PUBLIC_API_URL=https://api.vilnacrm.com\n' >"$FIXTURE/.env.example"
  printf 'NEXT_PUBLIC_API_URL=https://api.vilnacrm.com\n' >"$FIXTURE/.env.production"
  printf '# VilnaCRM website\n\nSee [LICENSE](LICENSE).\n' >"$FIXTURE/README.md"
  # Near misses: a hyphenated host that is not the sitemap placeholder, and a
  # GA-looking id that is not the G-XYZ one.
  printf 'const analyticsId = "G-1234567890";\n' >"$FIXTURE/src/features/landing/analytics.ts"
  printf 'export const preview = "https://uk-preview.vercel.app/";\n' >"$FIXTURE/src/features/landing/preview.ts"
}

# Run the gate from inside the fixture tree, exactly as the Make target runs
# it from the repository root. PLACEHOLDER_PATHS is passed through only when a
# test sets it, so the default scan set is what most cases exercise.
run_gate() {
  run env -C "$FIXTURE" \
    ${PLACEHOLDER_PATHS+PLACEHOLDER_PATHS="$PLACEHOLDER_PATHS"} \
    bash "$PROJECT_ROOT/$SCRIPT_REL"
}

setup() {
  assemble_clean_fixture
}

# --- The committed tree -------------------------------------------------------

@test "passes the committed repository from its root with the default scan set" {
  # No PLACEHOLDER_PATHS: this is exactly what `make lint-placeholders` runs,
  # so it also asserts the default roots all exist in the real tree.
  run env -u PLACEHOLDER_PATHS -C "$PROJECT_ROOT" bash "$SCRIPT_REL"
  [ "$status" -eq 0 ]
  assert_output_contains 'placeholders: OK'
  assert_output_contains "roots: $DEFAULT_ROOTS"
}

@test "the default scan set names every root the gate is documented to cover" {
  run env -u PLACEHOLDER_PATHS -C "$PROJECT_ROOT" bash "$SCRIPT_REL"
  [ "$status" -eq 0 ]
  for root in src pages public .env .env.example .env.production README.md; do
    assert_output_contains "$root"
  done
}

# --- Clean fixture ------------------------------------------------------------

@test "passes a clean fixture tree and reports how much it scanned" {
  run_gate
  [ "$status" -eq 0 ]
  assert_output_contains 'placeholders: OK'
  # 10 files: the near-miss sources count, the empty src/test does not.
  assert_output_contains '10 file(s) in scope, 4 token(s)'
}

@test "a near-miss host and a real-looking analytics id do not trip the gate" {
  # Both fixtures were written by assemble_clean_fixture; if the clean case
  # above went red they would be the first suspects, so pin them by name.
  run_gate
  [ "$status" -eq 0 ]
  refute_output_contains 'uk-preview.vercel.app'
  refute_output_contains 'G-1234567890'
}

# --- Every audited token turns the gate red -----------------------------------

@test "fails on the G-XYZ analytics placeholder in a page" {
  printf '<GoogleAnalytics gaId="G-XYZ" />\n' >"$FIXTURE/pages/_app.tsx"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'pages/_app.tsx:1:'
  assert_output_contains 'G-XYZ'
  assert_output_contains '::error::placeholders: 1 placeholder hit(s)'
}

@test "fails on the yourserver.io API host in an env file" {
  printf 'NEXT_PUBLIC_API_URL=https://yourserver.io/api/\n' >"$FIXTURE/.env"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains '.env:1:NEXT_PUBLIC_API_URL=https://yourserver.io/api/'
}

@test "fails on the uk-deploy.vercel.app sitemap origin in a public asset" {
  printf 'Sitemap: https://uk-deploy.vercel.app/\n' >"$FIXTURE/public/robots.txt"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'public/robots.txt:1:'
  assert_output_contains 'uk-deploy.vercel.app'
}

@test "fails on a frontend-ssr-template link in the README" {
  printf 'See [LICENSE](https://github.com/VilnaCRM-Org/frontend-ssr-template/blob/main/LICENSE).\n' \
    >>"$FIXTURE/README.md"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'README.md:4:'
  assert_output_contains 'frontend-ssr-template'
}

@test "reports every hit with its file and line, and counts them" {
  printf 'a\nb\nhttps://yourserver.io/api/\n' >"$FIXTURE/src/features/landing/config.ts"
  printf 'G-XYZ\n' >"$FIXTURE/.env.production"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'src/features/landing/config.ts:3:https://yourserver.io/api/'
  assert_output_contains '.env.production:1:G-XYZ'
  assert_output_contains '2 placeholder hit(s)'
}

# --- Matching rules -----------------------------------------------------------

@test "matches case-insensitively, so a re-cased token cannot slip through" {
  printf 'const id = "g-xyz";\n' >"$FIXTURE/src/features/landing/ga.ts"
  printf 'NEXT_PUBLIC_API_URL=https://YourServer.IO/\n' >"$FIXTURE/.env.example"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'src/features/landing/ga.ts:1:'
  assert_output_contains '.env.example:1:'
  assert_output_contains '2 placeholder hit(s)'
}

@test "matches tokens as fixed strings, so the dot in a hostname is not a wildcard" {
  # `yourserver.io` read as a regex would also match `yourserverXio`; as the
  # fixed string it must not.
  printf 'const host = "yourserverXio";\n' >"$FIXTURE/src/features/landing/host.ts"

  run_gate
  [ "$status" -eq 0 ]
}

@test "ignores src/test, whose fixtures legitimately carry look-alike values" {
  printf 'export const GA_PLACEHOLDER = "G-XYZ";\n' >"$FIXTURE/src/test/constants.ts"

  run_gate
  [ "$status" -eq 0 ]
  assert_output_contains 'placeholders: OK'
}

@test "the src/test exclusion is the exact directory, not a prefix" {
  # A sibling that merely starts with `src/test` is production source and
  # must still be scanned.
  mkdir -p "$FIXTURE/src/testing"
  printf 'export const host = "yourserver.io";\n' >"$FIXTURE/src/testing/host.ts"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'src/testing/host.ts:1:'
}

@test "a test directory anywhere else is still scanned" {
  mkdir -p "$FIXTURE/pages/test"
  printf 'const id = "G-XYZ";\n' >"$FIXTURE/pages/test/index.tsx"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'pages/test/index.tsx:1:'
}

@test "skips binary assets, which cannot carry a configuration placeholder" {
  # A NUL byte marks the file binary for grep; the token after it is a chance
  # byte sequence, not a value anyone could edit out.
  printf '\211PNG\000\000G-XYZ\n' >"$FIXTURE/public/logo.png"

  run_gate
  [ "$status" -eq 0 ]
  # Listed in scope, so a reviewer can see it was considered; matched never.
  assert_output_contains '11 file(s) in scope'
}

# --- Fail-closed paths --------------------------------------------------------

@test "fails when a scan root does not exist instead of skipping it" {
  PLACEHOLDER_PATHS='src pages no-such-dir' run_gate
  [ "$status" -eq 1 ]
  assert_output_contains "scan root 'no-such-dir' does not exist"
}

@test "fails when a default root is missing from the tree it is run in" {
  rm -rf "$FIXTURE/public"

  run_gate
  [ "$status" -eq 1 ]
  assert_output_contains "scan root 'public' does not exist"
  refute_output_contains 'placeholders: OK'
}

@test "fails when the scan set holds no files rather than passing vacuously" {
  mkdir -p "$FIXTURE/empty"

  PLACEHOLDER_PATHS='empty' run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'holds no files -- nothing was checked'
}

@test "fails when find reports an error, instead of scanning the partial list it printed" {
  # A traversal error (an unreadable directory, a file that vanished mid-walk)
  # makes find print what it could reach and exit non-zero. Read through a
  # process substitution that status is invisible, and a clean partial list
  # would certify a tree the gate never saw in full. The stub reproduces exactly
  # that shape: one real, clean file on stdout, then a failure.
  local stub="$BATS_TEST_TMPDIR/stub"
  mkdir -p "$stub"
  cat >"$stub/find" <<'SH'
#!/usr/bin/env bash
printf '%s\n' 'pages/index.tsx'
echo 'find: unreadable directory' >&2
exit 1
SH
  chmod +x "$stub/find"

  PATH="$stub:$PATH" run_gate
  [ "$status" -eq 1 ]
  assert_output_contains "could not enumerate scan root 'src'"
  refute_output_contains 'placeholders: OK'
}

@test "PLACEHOLDER_PATHS narrows the scan but cannot relax the token list" {
  printf 'G-XYZ\n' >"$FIXTURE/README.md"
  printf 'yourserver.io\n' >"$FIXTURE/src/features/landing/host.ts"

  PLACEHOLDER_PATHS='src' run_gate
  [ "$status" -eq 1 ]
  assert_output_contains 'src/features/landing/host.ts:1:'
  refute_output_contains 'README.md'
}

# --- The Make target ----------------------------------------------------------

@test "lint-placeholders runs the gate with plain bash from the repository root" {
  setup_makefile_test_env
  reset_command_log

  # The sandbox copies only Makefile, .env and scripts/; give it the rest of
  # the default scan set so the real script has a tree to certify.
  cp -R "$FIXTURE/src" "$FIXTURE/pages" "$FIXTURE/public" "$FIXTURE/README.md" \
    "$FIXTURE/.env.example" "$FIXTURE/.env.production" "$MAKEFILE_SANDBOX/"

  run_make_target lint-placeholders
  [ "$status" -eq 0 ]
  assert_output_contains 'placeholders: OK'

  # Hermetic: never routed through the dev container, the package manager or
  # the network client.
  run grep -E 'docker|bun|node|curl' "$COMMAND_LOG"
  [ "$status" -ne 0 ]
}

@test "lint-placeholders propagates a red scan as a failed make" {
  setup_makefile_test_env
  reset_command_log

  cp -R "$FIXTURE/src" "$FIXTURE/pages" "$FIXTURE/public" "$FIXTURE/README.md" \
    "$FIXTURE/.env.example" "$FIXTURE/.env.production" "$MAKEFILE_SANDBOX/"
  printf 'NEXT_PUBLIC_API_URL=https://yourserver.io/api/\n' >"$MAKEFILE_SANDBOX/.env"

  run_make_target lint-placeholders
  [ "$status" -ne 0 ]
  assert_output_contains '.env:1:NEXT_PUBLIC_API_URL=https://yourserver.io/api/'
}

@test "the lint aggregate and CI_LINT_TARGETS both include the placeholder gate" {
  run grep -E '^lint: .*lint-placeholders' "$PROJECT_ROOT/Makefile"
  [ "$status" -eq 0 ]

  run grep -E '^CI_LINT_TARGETS .*lint-placeholders' "$PROJECT_ROOT/Makefile"
  [ "$status" -eq 0 ]
}
