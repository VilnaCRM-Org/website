#!/usr/bin/env bats
#
# Coverage for the Storybook GitHub Pages publish (issue #523):
# scripts/ci/check-storybook-pages.mjs, the `check-storybook-pages` make target,
# and the shape of .github/workflows/storybook-deploy.yml.
#
# The site is served from https://vilnacrm-org.github.io/website/, so the gate's
# whole job is to fail on a build that would 404 under that sub-path. Every
# failure case below seeds exactly one such defect into an otherwise-clean
# fixture, so a gate that stopped reading one surface goes red here.
#
# The workflow is PARSED with js-yaml, never grep-scanned (CLAUDE.md, #447).

load './test_helper.bash'

SCRIPT="$PROJECT_ROOT/scripts/ci/check-storybook-pages.mjs"
WORKFLOW_REL='.github/workflows/storybook-deploy.yml'

# A minimal build in the shape Storybook emits: a manager page, a preview page
# that imports its bundles as ES modules, the story index, a webpack runtime
# with an empty public path, a bundle requesting an emitted font, and a
# stylesheet pointing at the same font plus an inline data URI.
seed_build() {
  BUILD="$BATS_TEST_TMPDIR/storybook-static-ci"
  mkdir -p "$BUILD/sb-manager" "$BUILD/static/media"
  cat > "$BUILD/index.html" <<'EOF'
<link rel="icon" href="./favicon.svg" />
<script type="module" src="./sb-manager/runtime.js"></script>
EOF
  cat > "$BUILD/iframe.html" <<'EOF'
<a href="https://storybook.js.org/docs">docs</a>
<a href="#root">skip</a>
<script type="module">import './runtime~main.iframe.bundle.js';
import './main.iframe.bundle.js?v=1';</script>
EOF
  echo '{"v":5,"entries":{}}' > "$BUILD/index.json"
  : > "$BUILD/favicon.svg"
  : > "$BUILD/sb-manager/runtime.js"
  echo "r.p = '';" > "$BUILD/runtime~main.iframe.bundle.js"
  echo 'e.exports=r.p+"static/media/Inter-Regular.abc123.woff2"' > "$BUILD/main.iframe.bundle.js"
  : > "$BUILD/static/media/Inter-Regular.abc123.woff2"
  cat > "$BUILD/static/fonts.css" <<'EOF'
@font-face { src: url('./media/Inter-Regular.abc123.woff2'); }
.icon { background: url(data:image/svg+xml;base64,PHN2Zy8+); }
EOF
}

check_build() {
  run node "$SCRIPT" "$BUILD"
}

workflow_json() {
  PROJECT_ROOT="$PROJECT_ROOT" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8")) || {};
    doc.triggers = doc.on !== undefined ? doc.on : doc.true;
    process.stdout.write(JSON.stringify(doc));
  ' "$1"
}

setup() {
  seed_build
}

# --- The gate --------------------------------------------------------------------

@test "passes a build whose every reference resolves under the sub-path" {
  check_build
  [ "$status" -eq 0 ]
  assert_output_contains 'resolves under a sub-path'
}

@test "fails a root-absolute src in the manager page" {
  sed -i 's|"./sb-manager/runtime.js"|"/sb-manager/runtime.js"|' "$BUILD/index.html"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'index.html: "/sb-manager/runtime.js" is root-absolute'
}

@test "fails a root-absolute module import in the preview page" {
  sed -i "s|import './main.iframe.bundle.js?v=1'|import '/main.iframe.bundle.js'|" "$BUILD/iframe.html"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'iframe.html: "/main.iframe.bundle.js" is root-absolute'
}

@test "fails a relative reference to a file the build never emitted" {
  rm "$BUILD/favicon.svg"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'index.html: "./favicon.svg" names no file in the build'
}

@test "fails a relative reference that climbs out of the build" {
  : > "$BATS_TEST_TMPDIR/outside.js"
  sed -i 's|"./sb-manager/runtime.js"|"../outside.js"|' "$BUILD/index.html"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains '"../outside.js" names no file in the build'
}

@test "fails a root-absolute url() in a stylesheet" {
  sed -i "s|url('./media/Inter-Regular.abc123.woff2')|url('/static/media/Inter-Regular.abc123.woff2')|" \
    "$BUILD/static/fonts.css"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'static/fonts.css: "/static/media/Inter-Regular.abc123.woff2" is root-absolute'
}

@test "fails a root-absolute webpack public path" {
  echo "r.p = '/';" > "$BUILD/runtime~main.iframe.bundle.js"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'webpack public path "/" is root-absolute'
}

@test "fails a bundle requesting a media asset the build never emitted" {
  rm "$BUILD/static/media/Inter-Regular.abc123.woff2"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'requests "static/media/Inter-Regular.abc123.woff2", which the build never emitted'
}

@test "fails a build missing the story index" {
  rm "$BUILD/index.json"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains 'index.json is missing from the build'
}

@test "fails closed when the build directory does not exist" {
  run node "$SCRIPT" "$BATS_TEST_TMPDIR/never-built"
  [ "$status" -eq 1 ]
  assert_output_contains 'is not a directory; build Storybook first'
}

@test "names every defect in one run" {
  rm "$BUILD/favicon.svg"
  echo "r.p = '/';" > "$BUILD/runtime~main.iframe.bundle.js"
  check_build
  [ "$status" -eq 1 ]
  assert_output_contains '2 problem(s)'
  assert_output_contains '"./favicon.svg" names no file in the build'
  assert_output_contains 'webpack public path "/" is root-absolute'
}

# --- The make target ------------------------------------------------------------

@test "check-storybook-pages runs the gate on the host over the Storybook output dir" {
  setup_makefile_test_env
  run_make_target check-storybook-pages
  [ "$status" -eq 0 ]
  assert_log_contains 'node scripts/ci/check-storybook-pages.mjs storybook-static-ci'
  run grep -c 'compose exec' "$COMMAND_LOG"
  [ "$output" = '0' ]
}

# --- The deploy workflow --------------------------------------------------------

@test "deploys only from main: push to main and dispatch, never a pull request" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  [ "$(jq -r '.triggers | keys | sort | join(",")' <<<"$doc")" = 'push,workflow_dispatch' ]
  [ "$(jq -c '.triggers.push' <<<"$doc")" = '{"branches":["main"]}' ]
  [ "$(jq -r '.jobs.build.if' <<<"$doc")" = \
    "github.repository == 'VilnaCRM-Org/website' && github.ref == 'refs/heads/main'" ]
}

@test "holds an empty token baseline and grants each job only what it uses" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  [ "$(jq -c '.permissions' <<<"$doc")" = '{}' ]
  [ "$(jq -c '.jobs.build.permissions' <<<"$doc")" = '{"contents":"read"}' ]
  [ "$(jq -c '.jobs.deploy.permissions' <<<"$doc")" = '{"pages":"write","id-token":"write"}' ]
}

@test "serialises Pages deployments without cancelling one in flight" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  [ "$(jq -c '.concurrency' <<<"$doc")" = '{"group":"github-pages","cancel-in-progress":false}' ]
  [ "$(jq -r '[.jobs[] | .["timeout-minutes"] | type] | unique | join(",")' <<<"$doc")" = 'number' ]
}

@test "builds and verifies through make, then uploads the directory the gate checked" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  [ "$(jq -r '[.jobs.build.steps[] | .run // empty] | join(";")' <<<"$doc")" = \
    'make storybook-build;make check-storybook-pages' ]
  out_dir="$(sed -n 's/^STORYBOOK_OUT_DIR *= *//p' "$PROJECT_ROOT/Makefile")"
  [ -n "$out_dir" ]
  [ "$(jq -r '.jobs.build.steps[] | select(.uses // "" | startswith("actions/upload-pages-artifact@")) | .with.path' \
    <<<"$doc")" = "$out_dir/" ]
}

@test "deploys through the github-pages environment and reports the page URL" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  [ "$(jq -r '.jobs.deploy.needs' <<<"$doc")" = 'build' ]
  [ "$(jq -r '.jobs.deploy.environment.name' <<<"$doc")" = 'github-pages' ]
  [ "$(jq -r '.jobs.deploy.environment.url' <<<"$doc")" = '${{ steps.deployment.outputs.page_url }}' ]
  [ "$(jq -r '.jobs.deploy.steps[] | select(.id == "deployment") | .uses' <<<"$doc")" = \
    'actions/deploy-pages@368f82528645a54fb793d4d04e342629a3f51346' ]
}

@test "a failed publish reaches the ci-alert issue" {
  doc="$(workflow_json "$PROJECT_ROOT/$WORKFLOW_REL")"
  name="$(jq -r '.name' <<<"$doc")"
  alerts="$(workflow_json "$PROJECT_ROOT/.github/workflows/ci-health-alerts.yml")"
  jq -e --arg name "$name" '.triggers.workflow_run.workflows | index($name)' <<<"$alerts"
}
