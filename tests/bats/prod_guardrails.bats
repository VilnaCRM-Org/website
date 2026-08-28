#!/usr/bin/env bats
#
# Coverage for scripts/ci/lint-prod-guardrails.mjs (issue #383).
#
# The three invariants this gate protects only ever hold in production, where no
# other PR check watches them: a privileged workflow whose failure nobody is told
# about, an edge handler that quietly reverts to passing every path to the S3
# origin, and browser source maps published to the CDN. A gate for that class of
# regression is only worth having if it is red on the exact regression, so every
# case below copies the REAL repository files into a fixture and mutates exactly
# one invariant.

load './test_helper.bash'

setup() {
  FIXTURE="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$FIXTURE/scripts"
  cp -R "$PROJECT_ROOT/.github" "$FIXTURE/.github"
  cp "$PROJECT_ROOT/jest.config.ts" "$FIXTURE/jest.config.ts"
  cp "$PROJECT_ROOT/next.config.js" "$FIXTURE/next.config.js"
  cp "$PROJECT_ROOT/scripts/cloudfront_routing.js" "$FIXTURE/scripts/cloudfront_routing.js"
}

run_guardrails() {
  run node "$PROJECT_ROOT/scripts/ci/lint-prod-guardrails.mjs" "$FIXTURE"
}

# --- Happy path ----------------------------------------------------------------

@test "passes against the committed repository" {
  run_guardrails
  [ "$status" -eq 0 ]
  assert_output_contains 'prod-guardrails: OK'
  assert_output_contains 'workflows audited'
}

# --- Assertion A: privileged workflows must be alerted on ----------------------

@test "fails when a privileged workflow drops out of the alert list" {
  # deploy.yml assumes the production AWS role on push to main. Removing its
  # `name:` from ci-health-alerts.yml's workflow_run list is exactly the drift
  # that leaves a broken production deploy unreported.
  local alerts="$FIXTURE/.github/workflows/ci-health-alerts.yml"
  grep -q '^      - website$' "$alerts"
  sed -i '/^      - website$/d' "$alerts"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'deploy.yml'
  assert_output_contains 'assumes an AWS role'
  assert_output_contains 'on.workflow_run.workflows'
}

@test "fails when a privileged workflow is renamed without updating the alert list" {
  # The coupling that surprises contributors: `name:` is load-bearing, because
  # workflow_run matches on it.
  sed -i '0,/^name: website$/s//name: website deploy/' "$FIXTURE/.github/workflows/deploy.yml"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'website deploy'
}

@test "accepts a new privileged workflow once it is added to the alert list" {
  sed -i '0,/^name: website$/s//name: website deploy/' "$FIXTURE/.github/workflows/deploy.yml"
  sed -i 's/^      - website$/      - website deploy/' "$FIXTURE/.github/workflows/ci-health-alerts.yml"

  run_guardrails
  [ "$status" -eq 0 ]
}

@test "exempts a privileged workflow that only runs on pull requests" {
  # A PR-scoped failure is already visible as a red check on the pull request,
  # so it needs no separate alert. sandbox-creating.yml relies on this.
  cat >"$FIXTURE/.github/workflows/pr-only-privileged.yml" <<'YAML'
name: pr only privileged
on:
  pull_request:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::1234:role/example
YAML

  run_guardrails
  [ "$status" -eq 0 ]
}

@test "fails on an unwatched privileged workflow added on a push trigger" {
  cat >"$FIXTURE/.github/workflows/rogue-deploy.yml" <<'YAML'
name: rogue deploy
on:
  push:
    branches:
      - main
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          role-to-assume: arn:aws:iam::1234:role/example
YAML

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'rogue deploy'
}

@test "accepts a release-cutting workflow when a release-audit workflow exists" {
  # A workflow that only cuts releases is covered by any workflow listening on
  # `release` — that is the audit path release-audit.yml provides.
  cat >"$FIXTURE/.github/workflows/rogue-release.yml" <<'YAML'
name: rogue release
on:
  push:
    branches:
      - main
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - run: gh release create v1.0.0
YAML

  run_guardrails
  [ "$status" -eq 0 ]
}

@test "fails on a release-cutting workflow when no release audit is present" {
  rm -f "$FIXTURE/.github/workflows/release-audit.yml"
  cat >"$FIXTURE/.github/workflows/rogue-release.yml" <<'YAML'
name: rogue release
on:
  push:
    branches:
      - main
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - run: gh release create v1.0.0
YAML

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'rogue release'
  assert_output_contains 'creates a GitHub release'
}

@test "a privileged workflow cannot vouch for itself via its own release trigger" {
  # Review finding: collectAlertCoverage used to scan every workflow including the
  # one under audit, so a workflow that both cut a release and listened on
  # `release` satisfied its own audit requirement.
  rm -f "$FIXTURE/.github/workflows/release-audit.yml"
  cat >"$FIXTURE/.github/workflows/self-vouching.yml" <<'YAML'
name: self vouching
on:
  push:
    branches:
      - main
  release:
    types:
      - published
jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      issues: write
    steps:
      - run: gh release create v1.0.0
YAML

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'self vouching'
}

@test "a workflow that cannot reach a human does not count as alert coverage" {
  # Listing a name under workflow_run is not enough: without issues: write the
  # listener can file nothing, so nobody is told.
  sed -i '/^      - website$/d' "$FIXTURE/.github/workflows/ci-health-alerts.yml"
  cat >"$FIXTURE/.github/workflows/fake-listener.yml" <<'YAML'
name: fake listener
on:
  workflow_run:
    workflows:
      - website
    types:
      - completed
jobs:
  noop:
    runs-on: ubuntu-latest
    permissions:
      contents: read
    steps:
      - run: echo "I cannot open an issue"
YAML

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'deploy.yml'
}

@test "detects a role assumed through the AWS CLI rather than the action" {
  cat >"$FIXTURE/.github/workflows/cli-role.yml" <<'YAML'
name: cli role
on:
  push:
    branches:
      - main
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: aws sts assume-role --role-arn arn:aws:iam::1234:role/example --role-session-name s
YAML

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'cli role'
}

@test "fails when the allow-list tables are declared with const instead of var" {
  # The freeze audit used to match `var` only, so switching to const dropped the
  # ALLOWED_* tables out of the immutability check entirely.
  sed -i 's/^var ALLOWED_DIRS = Object.freeze({$/const ALLOWED_DIRS = ({/' \
    "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'ALLOWED_DIRS'
  assert_output_contains 'mutable'
}

@test "fails when map is added to the edge extension allow-list" {
  sed -i "s/^  js: true,$/  js: true,\n  map: true,/" "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'ALLOWED_EXTENSIONS'
  assert_output_contains 'source maps'
}

@test "an origin fallthrough cannot hide behind a missing semicolon or a comment" {
  # ASI makes a bare `return request` valid, and a trailing comment used to break
  # the end-of-block anchor.
  python3 - "$FIXTURE/scripts/cloudfront_routing.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace('    return buildNotFoundResponse();\n',
              '    return request // fall back to the origin\n')
open(p, 'w').write(s)
PY

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'unconditional'
}

@test "fails when source maps are enabled by assignment rather than a literal key" {
  python3 - "$FIXTURE/next.config.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s += "\nmodule.exports.productionBrowserSourceMaps = true;\n"
open(p, 'w').write(s)
PY

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'productionBrowserSourceMaps'
}

@test "reports an unparseable workflow instead of crashing the whole gate" {
  # A duplicate key or bad indent must not take assertions B and C down with it,
  # which is what an uncaught js-yaml throw would do.
  printf 'name: broken\non:\n  push:\njobs:\n  a:\n    permissions:\n      issues: write\n      issues: write\n' \
    >"$FIXTURE/.github/workflows/broken.yml"
  sed -i 's/statusCode: 404,/statusCode: 200,/' "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'broken.yml is not valid YAML'
  # The later assertions still ran.
  assert_output_contains '[B]'
}

@test "fails when the workflow directory is missing entirely" {
  rm -rf "$FIXTURE/.github/workflows"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'is missing'
}

# --- Assertion B: the edge handler must stay fail-closed -----------------------

@test "fails when the edge handler reverts to origin pass-through" {
  # The literal regression this PR fixes: before issue #383 the handler's try
  # block ended in an unconditional `return request`.
  cat >"$FIXTURE/scripts/cloudfront_routing.js" <<'JS'
'use strict';
var ROUTE_MAP = Object.freeze({ '/': '/index.html' });
function handler(event) {
  var request = event.request;
  try {
    if (Object.prototype.hasOwnProperty.call(ROUTE_MAP, request.uri)) {
      request.uri = ROUTE_MAP[request.uri];
      return request;
    }
    return request;
  } catch (err) {
    return request;
  }
}
JS

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'unconditional'
  assert_output_contains 'fail closed'
}

@test "fails when an allow-list map is no longer frozen" {
  sed -i 's/^var ALLOWED_DIRS = Object.freeze({$/var ALLOWED_DIRS = ({/' \
    "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'ALLOWED_DIRS'
  assert_output_contains 'mutable'
}

@test "fails when an asset allow-list table is deleted outright" {
  # Deleting a table slips past the freeze audit, which only inspects the tables it
  # finds. The handler still reads ALLOWED_FILES, and the file is 'use strict', so
  # the missing binding throws inside the try and the catch hands every path to the
  # origin -- the exact pass-through this assertion exists to prevent.
  python3 - "$FIXTURE/scripts/cloudfront_routing.js" <<'PY'
import re
import sys
p = sys.argv[1]
s = open(p).read()
open(p, 'w').write(re.sub(r'var ALLOWED_FILES = Object\.freeze\(\{[\s\S]*?\n\}\);\n', '', s))
PY

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'ALLOWED_FILES'
  assert_output_contains 'no longer declares'
}

@test "fails when the synthetic 404 response is removed" {
  sed -i 's/statusCode: 404,/statusCode: 200,/' "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'synthetic 404'
}

@test "fails when the edge handler is missing" {
  rm -f "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'cloudfront_routing.js is missing'
}

@test "fails when the edge script is dropped from the 100% coverage layer" {
  # Unpinning coverage first would let a later routing regression land unnoticed,
  # so the pin itself is part of the contract.
  # Repoint just the routing entry. EDGE_COVERAGE_FROM became a multi-entry array
  # when #377 added cloudfront_security_headers.js to the same 100% layer, so match
  # the quoted entry rather than the whole declaration -- a declaration-shaped
  # pattern silently stops mutating the fixture and the test passes vacuously.
  sed -i "s#'<rootDir>/scripts/cloudfront_routing.js'#'<rootDir>/scripts/other.js'#" \
    "$FIXTURE/jest.config.ts"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'no longer collects edge coverage'
}

@test "fails when an edge coverage threshold drops below 100" {
  sed -i '/const EDGE_COVERAGE_THRESHOLD/,/};/ s/branches: 100/branches: 95/' \
    "$FIXTURE/jest.config.ts"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'threshold branches at 100'
}

@test "a commented-out coverage entry does not count as a live pin" {
  # The pin used to be read off the raw file, so commenting the entry out left the
  # gate green while Jest had already stopped collecting from the edge script.
  sed -i "s#^  '<rootDir>/scripts/cloudfront_routing.js',#  // '<rootDir>/scripts/cloudfront_routing.js',#" \
    "$FIXTURE/jest.config.ts"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'no longer collects edge coverage'
}

@test "a commented-out threshold does not mask a lowered live one" {
  # Keeping the 100% line as a comment above a lowered live one satisfied the
  # `branches: 100` search while the enforced floor was 95.
  sed -i '/const EDGE_COVERAGE_THRESHOLD/,/^};/ s#^  global: { branches: 100,#  // global: { branches: 100,\n  global: { branches: 95,#' \
    "$FIXTURE/jest.config.ts"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'threshold branches at 100'
}

# --- Assertion C: no production browser source maps ----------------------------

@test "fails when productionBrowserSourceMaps is enabled" {
  sed -i "s/  output: 'export',/  output: 'export',\n  productionBrowserSourceMaps: true,/" \
    "$FIXTURE/next.config.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'productionBrowserSourceMaps'
  assert_output_contains 'publishes'
}

@test "accepts productionBrowserSourceMaps pinned explicitly to false" {
  sed -i "s/  output: 'export',/  output: 'export',\n  productionBrowserSourceMaps: false,/" \
    "$FIXTURE/next.config.js"

  run_guardrails
  [ "$status" -eq 0 ]
}

@test "ignores a commented-out mention of the source-map option" {
  sed -i "s|  output: 'export',|  output: 'export',\n  // productionBrowserSourceMaps: true would publish sources.|" \
    "$FIXTURE/next.config.js"

  run_guardrails
  [ "$status" -eq 0 ]
}

# --- Reporting -----------------------------------------------------------------

@test "reports every violation in a single run rather than stopping at the first" {
  sed -i '/^      - website$/d' "$FIXTURE/.github/workflows/ci-health-alerts.yml"
  sed -i 's/statusCode: 404,/statusCode: 200,/' "$FIXTURE/scripts/cloudfront_routing.js"
  sed -i "s/  output: 'export',/  output: 'export',\n  productionBrowserSourceMaps: true,/" \
    "$FIXTURE/next.config.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains '[A]'
  assert_output_contains '[B]'
  assert_output_contains '[C]'
}

@test "a block comment cannot hide map in the edge extension allow-list" {
  # Review finding: `map/* x */: true` satisfied the table syntax while evading a
  # naive `map\s*:` test, so every structural check now runs on a comment-stripped
  # copy of the source.
  sed -i "s|^  js: true,$|  js: true,\n  map/* not a real extension */: true,|" \
    "$FIXTURE/scripts/cloudfront_routing.js"

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'ALLOWED_EXTENSIONS'
  assert_output_contains 'source maps'
}

@test "a comment containing a brace cannot truncate the extension table capture" {
  # A `})` inside a comment would end the non-greedy table capture early, hiding
  # anything after it from the map check.
  python3 - "$FIXTURE/scripts/cloudfront_routing.js" <<'PY'
import sys
p = sys.argv[1]
s = open(p).read()
s = s.replace('  css: true,', '  /* closes early: }) */\n  css: true,\n  map: true,')
open(p, 'w').write(s)
PY

  run_guardrails
  [ "$status" -eq 1 ]
  assert_output_contains 'source maps'
}
