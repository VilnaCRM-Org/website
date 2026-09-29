#!/usr/bin/env bats
#
# Contract coverage for .github/workflows/link-check.yml (issue #409).
#
# The weekly `external` leg files a tracking issue with whatever lychee reports, so a
# missing flag does not turn anything red -- it just buries the real findings. That is
# exactly what happened: without `--root-dir`, every root-relative asset href in the built
# export ("/layout/favicon/favicon.svg", "/_next/static/...") was reported as unresolvable,
# and 105 of the 110 reported errors were phantoms. Pin the flags here so the next edit to
# this workflow has to keep them.

load './test_helper.bash'

WORKFLOW_REL='.github/workflows/link-check.yml'

# Print the executable body of one top-level job. Job names sit at exactly two spaces of
# indent, so the next such line ends the block; every key inside a job is indented further.
#
# Comment lines are stripped. The steps below assert on flags, and the `run:` blocks explain
# each flag by name in a `#` comment -- so a grep over the raw block matches the prose and
# passes even when the flag itself has been deleted. Dropping comments first is what keeps
# these assertions non-vacuous.
extract_job() {
  local job="$1"

  awk -v header="  ${job}:" '
    $0 == header { inside = 1; next }
    inside && /^  [A-Za-z0-9_-]+:[[:space:]]*$/ { inside = 0 }
    inside && /^[[:space:]]*#/ { next }
    inside { print }
  ' "$PROJECT_ROOT/$WORKFLOW_REL"
}

setup() {
  [ -f "$PROJECT_ROOT/$WORKFLOW_REL" ]
  OFFLINE_JOB="$BATS_TEST_TMPDIR/offline.yml"
  EXTERNAL_JOB="$BATS_TEST_TMPDIR/external.yml"
  extract_job offline >"$OFFLINE_JOB"
  extract_job external >"$EXTERNAL_JOB"
}

@test "both link-check legs are extractable and non-empty" {
  # Guards the three tests below: if a job is renamed or reindented, extract_job silently
  # yields nothing, and the "offline leg has no --root-dir" assertion would then pass
  # against an empty file rather than against the real job.
  [ -s "$OFFLINE_JOB" ]
  [ -s "$EXTERNAL_JOB" ]
}

@test "the external leg resolves root-relative links against the exported site root" {
  # /repo is where the workflow mounts $GITHUB_WORKSPACE, and lychee requires an absolute
  # path here. Dropping this flag re-files ~105 phantom errors a week.
  run grep -F -- '--root-dir /repo/out' "$EXTERNAL_JOB"
  [ "$status" -eq 0 ]
}

@test "the external leg excludes the loopback dev-server URL" {
  # README.md documents <http://localhost:3000> as the dev-server address. Nothing listens
  # on the runner, so without this flag it can only ever report "Connection refused".
  run grep -F -- '--exclude-loopback' "$EXTERNAL_JOB"
  [ "$status" -eq 0 ]
}

@test "the blocking offline leg does not resolve root-relative links" {
  # This is what makes --root-dir safe on the external leg. The offline leg scans Markdown
  # only and never builds the export, so it must keep rejecting root-relative Markdown
  # links outright -- that is the gate that stops them reaching the weekly leg at all.
  run grep -F -- '--root-dir' "$OFFLINE_JOB"
  [ "$status" -ne 0 ]

  run grep -F -- '--offline' "$OFFLINE_JOB"
  [ "$status" -eq 0 ]
}

# Issue #508: `<a href="/swagger">` on /en/docs/api was reported missing because the export
# ships `out/swagger.html` and only the edge's ROUTE_MAP makes `/swagger` resolve. The
# remap rules mirror that table and nothing broader.
REMAP_SCRIPT_REL='scripts/ci/link-check-remaps.mjs'

# Apply lychee-style `<regex> <replacement>` rules (read from $RULES_FILE) to one URI, first
# match wins. The emitted rules use only syntax JS RegExp and Rust's regex crate share.
remap_uri() {
  node -e '
    const fs = require("node:fs");
    const uri = process.argv[1];
    for (const line of fs.readFileSync(process.env.RULES_FILE, "utf8").split("\n")) {
      if (!line) continue;
      const [pattern, replacement] = line.split(" ");
      const re = new RegExp(pattern);
      if (re.test(uri)) { process.stdout.write(uri.replace(re, replacement)); process.exit(0); }
    }
    process.stdout.write(uri);
  ' "$1"
}

# A throwaway tree holding the real generator next to a fake edge handler, because the
# generator resolves the handler relative to its own location.
generate_with_route_map() {
  local tree="$BATS_TEST_TMPDIR/tree"

  mkdir -p "$tree/scripts/ci"
  cp "$PROJECT_ROOT/$REMAP_SCRIPT_REL" "$tree/$REMAP_SCRIPT_REL"
  printf '%s\n' "$1" >"$tree/scripts/cloudfront_routing.js"
  run node "$tree/$REMAP_SCRIPT_REL" /repo/out
}

@test "the external leg passes the generated edge remaps to lychee" {
  run grep -F -- "node $REMAP_SCRIPT_REL /repo/out" "$EXTERNAL_JOB"
  [ "$status" -eq 0 ]

  run grep -F -- '--remap "$rule"' "$EXTERNAL_JOB"
  [ "$status" -eq 0 ]

  run grep -F -- '--exclude-loopback "${remap_args[@]}"' "$EXTERNAL_JOB"
  [ "$status" -eq 0 ]
}

@test "the external leg does not fall back to any .html file the export contains" {
  # --fallback-extensions html also accepts /offline, /404 and /index, which the edge 404s.
  run grep -F -- '--fallback-extensions' "$EXTERNAL_JOB"
  [ "$status" -ne 0 ]

  run grep -F -- '--remap' "$OFFLINE_JOB"
  [ "$status" -ne 0 ]
}

@test "the remap rules rewrite every ROUTE_MAP route to its target, keeping query and fragment" {
  RULES_FILE="$BATS_TEST_TMPDIR/rules.txt"
  export RULES_FILE
  node "$PROJECT_ROOT/$REMAP_SCRIPT_REL" /repo/out >"$RULES_FILE"

  [ "$(remap_uri file:///repo/out/swagger)" = 'file:///repo/out/swagger.html' ]
  [ "$(remap_uri file:///repo/out/swagger/)" = 'file:///repo/out/swagger.html' ]
  [ "$(remap_uri 'file:///repo/out/swagger#tag')" = 'file:///repo/out/swagger.html#tag' ]
  [ "$(remap_uri 'file:///repo/out/swagger?a=1#tag')" = 'file:///repo/out/swagger.html?a=1#tag' ]
  [ "$(remap_uri file:///repo/out/en)" = 'file:///repo/out/en.html' ]
  [ "$(remap_uri file:///repo/out/en/docs/api)" = 'file:///repo/out/en/docs/api.html' ]
  [ "$(remap_uri file:///repo/out)" = 'file:///repo/out/index.html' ]
  [ "$(remap_uri 'file:///repo/out/#top')" = 'file:///repo/out/index.html#top' ]
}

@test "the remap rules leave every route the edge does not map unresolved" {
  RULES_FILE="$BATS_TEST_TMPDIR/rules.txt"
  export RULES_FILE
  node "$PROJECT_ROOT/$REMAP_SCRIPT_REL" /repo/out >"$RULES_FILE"

  # /offline is the recorded ROUTE_MAP exemption; /404 and /index exist only as files.
  local uri
  for uri in offline 404 index swaggerx en/docs en/docs/apix en.html swagger.html; do
    [ "$(remap_uri "file:///repo/out/$uri")" = "file:///repo/out/$uri" ]
  done
  [ "$(remap_uri file:///elsewhere/swagger)" = 'file:///elsewhere/swagger' ]
}

@test "the remap generator escapes regex metacharacters in a route" {
  generate_with_route_map "var ROUTE_MAP = { '/a.b': '/a.b.html' };"
  assert_success

  RULES_FILE="$BATS_TEST_TMPDIR/rules.txt"
  export RULES_FILE
  printf '%s\n' "$output" >"$RULES_FILE"
  [ "$(remap_uri file:///repo/out/a.b)" = 'file:///repo/out/a.b.html' ]
  [ "$(remap_uri file:///repo/out/aXb)" = 'file:///repo/out/aXb' ]
}

@test "the remap generator refuses a trailing-slash route without its bare twin" {
  generate_with_route_map "var ROUTE_MAP = { '/x/': '/x.html' };"
  [ "$status" -ne 0 ]
  assert_output_contains 'maps /x/ but not /x'
}

@test "the remap generator refuses spellings that rewrite to different targets" {
  generate_with_route_map "var ROUTE_MAP = { '/x': '/x.html', '/x/': '/y.html' };"
  [ "$status" -ne 0 ]
  assert_output_contains 'different targets'
}

@test "the remap generator fails closed on an empty or missing ROUTE_MAP" {
  generate_with_route_map 'var ROUTE_MAP = {};'
  [ "$status" -ne 0 ]
  assert_output_contains 'no ROUTE_MAP routes'

  generate_with_route_map 'var OTHER = {};'
  [ "$status" -ne 0 ]
  assert_output_contains 'did not declare a ROUTE_MAP'
}

@test "the remap generator refuses a site root lychee cannot use" {
  local root
  for root in '' 'repo/out' '/repo/my out'; do
    run node "$PROJECT_ROOT/$REMAP_SCRIPT_REL" "$root"
    [ "$status" -ne 0 ]
    assert_output_contains 'usage:'
  done

  run node "$PROJECT_ROOT/$REMAP_SCRIPT_REL"
  [ "$status" -ne 0 ]
}
