#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-node-version-sources.sh (issue #335) -- the gate
# behind `make lint-node-version`. It is the only thing standing between the repo
# and four independently editable Node version sources drifting apart, so every
# drift it claims to catch is pinned here, alongside the happy path and the
# vacuity guards that stop the gate from passing when it inspected nothing.

load './test_helper.bash'

SCRIPT_REL='scripts/ci/check-node-version-sources.sh'

NVMRC_VERSION='24.18.0'

# Build a fixture repository under $1 whose four Node version sources all agree.
make_consistent_repo() {
  local dir="$1"

  mkdir -p "$dir/.github/workflows"

  printf '%s\n' "$NVMRC_VERSION" >"$dir/.nvmrc"

  cat >"$dir/Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
FROM base AS build
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS production
EOF

  cat >"$dir/Apollo.Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
EOF

  cat >"$dir/package.json" <<EOF
{
  "name": "fixture",
  "engines": {
    "node": "^${NVMRC_VERSION}",
    "bun": ">=1.3.5"
  }
}
EOF

  cat >"$dir/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
EOF
}

run_checker() {
  run bash "$PROJECT_ROOT/$SCRIPT_REL" "$1"
}

setup() {
  REPO="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$REPO"
}

@test "passes when every Node version source agrees" {
  make_consistent_repo "$REPO"

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
  assert_output_contains "$NVMRC_VERSION"
}

@test "passes against the real repository" {
  run_checker "$PROJECT_ROOT"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "fails when a Dockerfile base image drifts from .nvmrc" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Apollo.Dockerfile" <<'EOF'
FROM public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'Apollo.Dockerfile pins node:23.11.1'
  assert_output_contains "$NVMRC_VERSION"
}

@test "fails when only the second stage of a Dockerfile drifts" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23 AS base
FROM public.ecr.aws/docker/library/node:24.17.0-alpine3.23 AS production
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins node:24.17.0'
}

@test "fails when package.json engines.node only admits the pin instead of pinning it" {
  make_consistent_repo "$REPO"
  cat >"$REPO/package.json" <<'EOF'
{
  "name": "fixture",
  "engines": {
    "node": "^24",
    "bun": ">=1.3.5"
  }
}
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "engines.node is '^24'"
  assert_output_contains "expected '^${NVMRC_VERSION}'"
}

@test "fails when a setup-node step does not read .nvmrc" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24.18.0
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'actions/setup-node'
  assert_output_contains "node-version-file: '.nvmrc'"
}

@test "fails when a flagged FROM drifts, rather than skipping the line" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Apollo.Dockerfile" <<'EOF'
FROM --platform=linux/amd64 public.ecr.aws/docker/library/node:23.11.1-alpine3.21 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins node:23.11.1'
}

@test "accepts the bare 'FROM node:<version> AS <stage>' form" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Apollo.Dockerfile" <<EOF
FROM node:${NVMRC_VERSION} AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "accepts a digest-pinned base image" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Apollo.Dockerfile" <<EOF
FROM public.ecr.aws/docker/library/node:${NVMRC_VERSION}-alpine3.23@sha256:0000000000000000000000000000000000000000000000000000000000000000 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "counts a quoted actions/setup-node reference as a step" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
        with:
          node-version: 24.18.0
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a commented-out node-version-file as the input" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24.18.0
      # node-version-file: '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "judges each setup-node step on its own inputs" {
  make_consistent_repo "$REPO"
  # One compliant step and one that pins a literal version: whole-file counting would
  # balance out to zero, per-step checking must still fail.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
      - name: Set up a second Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24.18.0
      - name: Something with its own nested list
        with:
          paths:
            - '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains '1 actions/setup-node step(s)'
}

@test "does not read a setup-node step out of the text of a run: block" {
  make_consistent_repo "$REPO"
  # A `run:` script is literal scalar content, not YAML structure. Reading it as
  # structure would let a workflow that never sets Node up satisfy the vacuity guard.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Print the setup we are supposed to have
        run: |
          echo "- uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
          echo "  with:"
          echo "    node-version-file: '.nvmrc'"
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'no actions/setup-node step found'
}

@test "does not accept node-version-file declared outside the step's with: mapping" {
  make_consistent_repo "$REPO"
  # `setup-node` reads its inputs from `with:` only; the same key under `env:` is a
  # plain environment variable the action never looks at.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        env:
          node-version-file: '.nvmrc'
        with:
          node-version: 24.18.0
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a with: mapping nested below the step's own keys" {
  make_consistent_repo "$REPO"
  # `with:` is an input mapping only where it is a direct key of the step. Buried under
  # `env:` it is an environment variable named "with", which setup-node never reads --
  # accepting it would let the contrived shape below sneak an unpinned step past the gate.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        env:
          with:
            node-version-file: '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "accepts a with: mapping written in single-line flow style" {
  make_consistent_repo "$REPO"
  # `with: { node-version-file: '.nvmrc' }` is the same mapping as the block form and is
  # equally valid YAML, so the gate must credit it rather than report a compliant step.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache: 'bun', node-version-file: '.nvmrc' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "fails a flow-style with: mapping that pins a literal Node version" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version: '20' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "still credits a flow-style pin whose earlier entry quotes a comma" {
  make_consistent_repo "$REPO"
  # The scanner walks the flow mapping one `key: value,` entry at a time. A comma inside
  # a quoted value is part of that value, not the end of the entry, so the real pin that
  # follows it must still be found -- the strictness below must not cost a true positive.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache-dependency-path: 'a,b', node-version-file: .nvmrc }
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "does not accept a flow-style key that merely ends in node-version-file" {
  make_consistent_repo "$REPO"
  # `legacy-node-version-file:` is not an input setup-node reads, and the block spelling
  # of it is already rejected. Scanning the flow mapping for a loose `node-version-file:`
  # anywhere inside the braces would read the tail of this longer key as the key itself,
  # so the two spellings of the same non-input would contradict each other.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { legacy-node-version-file: '.nvmrc' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept an x- prefixed flow-style key as the node-version-file input" {
  make_consistent_repo "$REPO"
  # Same hole reached through a later entry of the mapping: the prefixed key has to be
  # stepped over as one entry, never partially consumed into a match.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache: bun, x-node-version-file: .nvmrc }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a flow-style key spelled inside a quoted value" {
  make_consistent_repo "$REPO"
  # The whole `'a, node-version-file: .nvmrc,'` scalar is the value of `cache:`; setup-node
  # receives no node-version-file at all. A scan that stops at the first comma instead of
  # consuming the quoted value whole reads the middle of that string as a real input.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache: 'a, node-version-file: .nvmrc,' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a flow-style pin whose quotes do not match" {
  make_consistent_repo "$REPO"
  # `'.nvmrc"` is not the path `.nvmrc` to any YAML reader, so it must not be one here.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version-file: '.nvmrc" }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "fails a flow-style literal Node version declared beside the .nvmrc pin" {
  make_consistent_repo "$REPO"
  # The per-step rule is already satisfied by the pin, so only the literal check can see
  # this -- and setup-node resolves node-version ahead of node-version-file, which makes
  # the literal the version that actually runs.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version-file: '.nvmrc', node-version: '24.18.0' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "fails a block-style literal Node version declared beside the .nvmrc pin" {
  make_consistent_repo "$REPO"
  # The same drift in the other spelling: the two must not disagree about it.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          node-version: '24.18.0'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "fails a double-quoted node-version key declared beside the .nvmrc pin" {
  make_consistent_repo "$REPO"
  # `"node-version": '24.18.0'` is the same mapping key as `node-version:` to every YAML
  # reader, and setup-node still resolves it ahead of node-version-file. A scanner that
  # knows only the bare spelling reads this as some other key and passes the literal.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          "node-version": '24.18.0'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "fails a single-quoted node-version key declared beside the .nvmrc pin" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          'node-version': "24.18.0"
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "fails a quoted node-version key inside a flow-style with: mapping" {
  make_consistent_repo "$REPO"
  # The same key, the same quoting, written in the other spelling of the mapping: the
  # flow walker has to know all three spellings too, or the hole simply moves onto one line.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { node-version-file: '.nvmrc', "node-version": '20' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "credits a quoted node-version-file key in block style" {
  make_consistent_repo "$REPO"
  # The other half of the same rule: quoting a key must not turn a compliant step into a
  # reported one either, or the gate starts failing correct workflows.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          "node-version-file": '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "credits a quoted key inside the flow mapping exactly as the bare one" {
  make_consistent_repo "$REPO"
  # Bare `cache-dependency-path: 'a,b', node-version-file: .nvmrc` is already credited;
  # quoting the keys changes nothing about what setup-node receives, so it must not change
  # the verdict -- including for the entries the walker only steps over.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { "cache-dependency-path": 'a,b', 'node-version-file': ".nvmrc" }
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "credits a step whose uses: and with: keys are quoted too" {
  make_consistent_repo "$REPO"
  # `uses` and `with` are keys like any other. Missing their quoted spellings hides the
  # whole step -- which is worse than a wrong verdict: the step stops being counted, and a
  # repository whose only setup-node steps are written this way passes on an empty subject.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        "uses": "actions/setup-node@820762786026740c76f36085b0efc47a31fe5020"
        'with':
          node-version-file: '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
  assert_output_contains '1 setup-node step(s)'
}

@test "counts a step with quoted keys that pins a literal version" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        'uses': 'actions/setup-node@820762786026740c76f36085b0efc47a31fe5020'
        "with": { "node-version": '20' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
  assert_output_contains 'pins a literal node-version'
}

@test "does not accept a quoted key that merely ends in node-version-file" {
  make_consistent_repo "$REPO"
  # Accepting quoted keys must not widen the key itself. The quoted alternative is anchored
  # at the opening quote, so a longer key cannot have its tail read as this one -- exactly
  # the rule the bare spelling already enforces.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          "legacy-node-version-file": '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a quoted lookalike key inside a flow mapping" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache: bun, 'x-node-version-file': .nvmrc }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a key whose own quotes do not match" {
  make_consistent_repo "$REPO"
  # `"node-version-file'` opens with one quote and closes with the other, so it is not this
  # key -- nor any key -- to a YAML reader, and must not credit the step.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          "node-version-file': '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept mismatched key quotes inside a flow mapping" {
  make_consistent_repo "$REPO"
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { "node-version-file': '.nvmrc' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a quoted with: nested below the step's own keys" {
  make_consistent_repo "$REPO"
  # The `with:` scope rule is about the key's column, not its spelling: quoting it must not
  # smuggle an `env:`-nested mapping back in as an input mapping.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        env:
          "with":
            "node-version-file": '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not accept a quoted key spelled inside a quoted flow value" {
  make_consistent_repo "$REPO"
  # The whole scalar is the value of `cache:`; the quoted key inside it is text, and the
  # entry walk has to step over it as one entry rather than read into it.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { cache: 'a, "node-version-file": .nvmrc,' }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "does not read the tail of a quoted key as the node-version-file input" {
  make_consistent_repo "$REPO"
  # One key, quoted, that happens to contain a colon and a comma: `node-version-file` here
  # is the end of the KEY, not an entry of its own, so setup-node receives no such input.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with: { "cache: bun, node-version-file": .nvmrc }
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "fails a quoted literal node-version declared outside any step" {
  make_consistent_repo "$REPO"
  # The literal rule is deliberately position-independent, and quoting must not move a
  # declaration out of its reach.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    env:
      "node-version": '18'
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'pins a literal node-version'
}

@test "does not read a step out of a block scalar hanging off a quoted key" {
  make_consistent_repo "$REPO"
  # `"run": |` is the same block-scalar header as `run: |`; its content is literal text and
  # must not be read back as the step's inputs.
  cat >"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
jobs:
  unit:
    steps:
      - name: Set up Node.js
        uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        "run": |
          "node-version-file": '.nvmrc'
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains "without \`node-version-file: '.nvmrc'\`"
}

@test "aborts rather than passing vacuously when no setup-node step is found" {
  make_consistent_repo "$REPO"
  rm "$REPO/.github/workflows/unit-testing.yml"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'no actions/setup-node step found'
}

@test "aborts when the workflow directory itself is absent" {
  make_consistent_repo "$REPO"
  rm -r "$REPO/.github"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains '.github/workflows is missing'
}

@test "fails when a workflow reintroduces vars.NODE_VERSION" {
  make_consistent_repo "$REPO"
  cat >>"$REPO/.github/workflows/unit-testing.yml" <<'EOF'
      - name: Legacy setup
        run: echo "${{ vars.NODE_VERSION }}"
EOF

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'vars.NODE_VERSION'
}

@test "aborts when .nvmrc is missing" {
  make_consistent_repo "$REPO"
  rm "$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains '.nvmrc is missing'
}

@test "aborts when .nvmrc does not pin an exact version" {
  make_consistent_repo "$REPO"
  printf '24\n' >"$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'exact MAJOR.MINOR.PATCH'
}

@test "aborts rather than repairing whitespace inside .nvmrc" {
  make_consistent_repo "$REPO"
  printf '  24. 18.0  \n' >"$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'exact MAJOR.MINOR.PATCH'
  assert_output_contains '24. 18.0'
}

@test "aborts when .nvmrc carries anything beyond its one version line" {
  make_consistent_repo "$REPO"
  # nvm, actions/setup-node and this check all read line 1 only, so a second line is
  # drift that every consumer discards and every reader believes.
  printf '%s\n20.11.0\n' "$NVMRC_VERSION" >"$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'nothing but one version line'
}

@test "tolerates trailing blank lines in .nvmrc" {
  make_consistent_repo "$REPO"
  printf '%s\n\n\n' "$NVMRC_VERSION" >"$REPO/.nvmrc"

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}

@test "aborts rather than passing vacuously when no Node base image is found" {
  make_consistent_repo "$REPO"
  rm "$REPO/Dockerfile" "$REPO/Apollo.Dockerfile"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'would pass vacuously'
}

@test "aborts when package.json declares no engines.node" {
  make_consistent_repo "$REPO"
  printf '{ "name": "fixture" }\n' >"$REPO/package.json"

  run_checker "$REPO"
  [ "$status" -eq 1 ]
  assert_output_contains 'no engines.node'
}

@test "ignores an image whose name merely ends in node" {
  make_consistent_repo "$REPO"
  cat >"$REPO/Mockoon.Dockerfile" <<'EOF'
FROM ghcr.io/example/mynode:1.2.3 AS base
EOF

  run_checker "$REPO"
  [ "$status" -eq 0 ]
  assert_output_contains 'node-version: OK'
}
