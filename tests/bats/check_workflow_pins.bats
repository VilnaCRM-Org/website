#!/usr/bin/env bats
#
# Coverage for scripts/ci/check-workflow-pins.mjs (issue #447).
#
# The rule this gate carries is one line long — every `actions/setup-node` step
# resolves Node through .nvmrc, and nothing declares the version a second way —
# and it used to be enforced by scanning workflow YAML with regex. That scanner
# needed seven separate spelling fixes in a single day, each one a valid YAML
# construct it did not recognise, and a differential sweep against a real parser
# judged ~38% of generated real-world-shaped inputs wrong.
#
# So the cases below are not "does the happy path work". They are the corpus of
# spellings that broke the scanner, split into the two verdicts that matter: a
# document a runner would honour as pinned must be GREEN however it is spelled,
# and a document that genuinely leaves Node unpinned — or declares it twice —
# must be RED however it is disguised. Each one is a whole workflow, because the
# gate's subject is a document, not a line.

load './test_helper.bash'

BASELINE_WORKFLOW='name: baseline
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
'

setup() {
  FIXTURE="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$FIXTURE/.github/workflows"
  cp "$PROJECT_ROOT/.nvmrc" "$FIXTURE/.nvmrc"
  # A plainly-spelled pinned workflow beside every probe, so the directory-wide
  # vacuity guard never fires and each verdict is attributable to the probe alone.
  printf '%s' "$BASELINE_WORKFLOW" > "$FIXTURE/.github/workflows/zz-baseline.yml"
}

# Write the probe workflow, then judge it. Heredoc-fed so a case reads as the
# YAML a contributor would actually write.
write_probe() {
  cat > "$FIXTURE/.github/workflows/probe.yml"
}

run_pins() {
  run node "$PROJECT_ROOT/scripts/ci/check-workflow-pins.mjs" "$FIXTURE"
}

assert_green() {
  run_pins
  [ "$status" -eq 0 ]
  assert_output_contains 'Workflow Node pins OK'
}

assert_red() {
  run_pins
  [ "$status" -eq 1 ]
  assert_output_contains 'Workflow Node-pin check failed'
}

# --- The committed tree ---------------------------------------------------------

@test "passes against the committed repository" {
  run node "$PROJECT_ROOT/scripts/ci/check-workflow-pins.mjs" "$PROJECT_ROOT"
  [ "$status" -eq 0 ]
  assert_output_contains 'Workflow Node pins OK'
  assert_output_contains 'resolve Node through .nvmrc'
}

@test "fails on every drift seeded into a real committed workflow" {
  # The synthetic probes below prove the gate reads YAML correctly. This one
  # proves it is pointed at the repository: each mutation is applied to the real
  # .github/workflows tree, and each has to turn the gate red on its own.
  local real="$BATS_TEST_TMPDIR/real"
  mkdir -p "$real"
  cp "$PROJECT_ROOT/.nvmrc" "$real/.nvmrc"
  cp -R "$PROJECT_ROOT/.github" "$real/.github"

  run node "$PROJECT_ROOT/scripts/ci/check-workflow-pins.mjs" "$real"
  [ "$status" -eq 0 ]

  local label file mutation
  while IFS='|' read -r label file mutation; do
    [ -n "$label" ] || continue

    (cd "$real" && eval "$mutation")

    run node "$PROJECT_ROOT/scripts/ci/check-workflow-pins.mjs" "$real"
    if [ "$status" -eq 0 ]; then
      echo "expected the workflow pin gate to fail after drifting: $label" >&2
      printf '%s\n' "${output-}" >&2
      return 1
    fi

    # A mutation that ADDS a file (a rogue workflow) has no committed original to
    # copy back, so restoring means deleting it.
    if [ -e "$PROJECT_ROOT/$file" ]; then
      cp "$PROJECT_ROOT/$file" "$real/$file"
    else
      rm -f "$real/$file"
    fi
    run node "$PROJECT_ROOT/scripts/ci/check-workflow-pins.mjs" "$real"
    # `return 1`, not a bare `[ ... ]`: a `while read` loop's exit status is only its
    # LAST body command, so a bare assertion failing on any earlier iteration would be
    # swallowed and the test would still pass.
    if [ "$status" -ne 0 ]; then
      echo "restoring the tree after \"$label\" left the gate red" >&2
      printf '%s\n' "${output-}" >&2
      return 1
    fi
  done <<'EOF'
literal node-version in a workflow|.github/workflows/bats-testing.yml|sed -i "s#node-version-file:.*#node-version: '99.0.0'#" .github/workflows/bats-testing.yml
setup-node step with no version file|.github/workflows/bats-testing.yml|sed -i "/node-version-file:/d" .github/workflows/bats-testing.yml
literal node-version in a .yaml workflow|.github/workflows/rogue.yaml|printf 'jobs:\n  a:\n    steps:\n      - uses: actions/setup-node@abc\n        with:\n          node-version: 20\n' > .github/workflows/rogue.yaml
a repository variable reintroduced|.github/workflows/bats-testing.yml|sed -i "s#node-version-file: '.nvmrc'#node-version-file: \${{ vars.NODE_VERSION }}#" .github/workflows/bats-testing.yml
EOF
  # The bats job is the workflow these mutations drift because #399 moved the lint
  # and test gates into the dev container and stripped `actions/setup-node` from
  # the workflows that followed. Its subject IS the host side of the Makefile, so
  # it keeps a host Node pin. If that ever changes this test fails loudly rather
  # than silently testing nothing; repoint it at another workflow that still
  # declares `node-version-file`.
}

@test "counts the setup-node steps it actually read" {
  # The count is the gate's own evidence that it found its subject. A silent drop
  # to zero is what the vacuity guard below exists to catch, so the number has to
  # be reported rather than merely computed.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
  assert_output_contains '3 actions/setup-node step(s)'
  assert_output_contains '2 workflow(s)'
}

# --- Spellings a runner honours, which the regex scanner refused ------------------

@test "credits a step written as a compact flow mapping" {
  # Defect: every rule in the old scanner was anchored to a mapping key on its own
  # line, so a step whose keys sit after a brace was unreadable — and being
  # unreadable, it was refused rather than checked.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/setup-node@v6, with: { node-version-file: .nvmrc } }
Y
  assert_green
}

@test "credits a step inside a flow sequence of steps" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps: [{ uses: actions/setup-node@v6, with: { node-version-file: .nvmrc } }]
Y
  assert_green
}

@test "credits a key spelled with a numeric YAML escape" {
  # `\x65` is `e`, so this is the key `node-version-file` to every YAML reader and
  # to setup-node. The old gate could not decode it, so it refused the file rather
  # than guess — a false rejection of a document that pins Node correctly.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { "node-version-fil\x65": .nvmrc }
Y
  assert_green
}

@test "credits a step whose action reference is itself escaped" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: "actions/setup-nod\x65@v6"
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "credits a pin reached through an anchor and an alias" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: &pin
          node-version-file: .nvmrc
      - uses: actions/setup-node@v6
        with: *pin
Y
  assert_green
}

@test "credits a pin merged in with a merge key" {
  write_probe <<'Y'
name: p
on: [push]
defaults: &pin
  node-version-file: .nvmrc
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          <<: *pin
Y
  assert_green
}

@test "credits a step carrying a double-quoted value continued onto the next line" {
  # YAML folds a `\`-terminated double-quoted scalar onto the following line. A
  # line-based scanner cannot see that scalar whole, so the old gate refused the
  # whole file; a parser reads one string and moves on.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: "a rather long step \
          name"
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "credits a pin beside a key whose doubled quote hides comma-and-colon text" {
  # The key is `q': v, node-version-file: .nvmrc, r`. Reading it as structure
  # desynchronises an entry-wise walk; reading it as a key is what YAML does.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { 'q'': v, node-version-file: .nvmrc, r': 1, node-version-file: .nvmrc }
Y
  assert_green
}

@test "credits every quote spelling of the same keys" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - "uses": 'actions/setup-node@v6'
        "with": { "node-version-file": ".nvmrc" }
Y
  assert_green
}

@test "credits a key separated from its colon by whitespace" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses : actions/setup-node@v6
        with :
          node-version-file : .nvmrc
Y
  assert_green
}

@test "credits a bare action reference with no version at all" {
  # `uses: actions/setup-node` resolves to the action's default branch. It is a
  # setup-node step, and the pin rule applies to it exactly as to a tagged one.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "credits a step whose action reference is spelled in mixed case" {
  # GitHub resolves an action's owner and repository case-insensitively, so this is
  # the same action — and a case-sensitive gate would skip both the pin rule and the
  # step count for it.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: Actions/Setup-Node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
  # Counted, not merely tolerated: a gate that silently skipped this spelling would
  # also stay green, so the step COUNT is what proves it was read.
  assert_output_contains '2 actions/setup-node step(s)'
}

@test "does not read an action input named uses: as a step" {
  # `with:` inputs are data. Applying the step rules to every mapping in the
  # document invents a pin failure for an action whose input happens to be called
  # `uses` — the false-rejection direction.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - uses: ./.github/actions/local
        with:
          uses:
            - one
            - two
Y
  assert_green
}

@test "does not read an action input named steps: as a steps sequence" {
  # The mirror of the case above, one level out. Step-ness is a property of the
  # `jobs.<id>.steps` sequence, not of any key whose name ends in `steps`: an
  # action input called `steps` carrying mappings with `uses:` is data GitHub
  # never runs, so applying the step rules to it invents a pin failure whose
  # only fix is renaming somebody else's action input.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - uses: ./.github/actions/local
        with:
          steps:
            - uses: actions/setup-node@v6
            - uses: 42
Y
  assert_green
}

# --- Prose is not structure ------------------------------------------------------

@test "does not read a run: body quoting the canonical snippet as a step" {
  # Documentation echoing `uses:` and `node-version:` into a shell heredoc is a
  # string, not a mapping. Refusing it would invent a pin failure whose only fix
  # is deleting the prose.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - run: |
          echo "uses: actions/setup-node@v6"
          echo "node-version: 20"
Y
  assert_green
}

@test "does not read a comment naming the repository variable as a read" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      # never reach for ${{ vars.NODE_VERSION }} here
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "does not read a bare mention of the variable as a read" {
  # GitHub substitutes only inside `${{ }}`. A sentence naming the variable
  # reintroduces nothing, and failing a PR for one is a false rejection.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: do not use vars.NODE_VERSION
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "does not read an action named in a value as a step" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: bump actions/setup-node@v6
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "does not mistake a longer action name for setup-node" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - uses: actions/setup-node-extra@v1
Y
  assert_green
}

# --- Steps that genuinely leave Node unpinned ------------------------------------

@test "fails a setup-node step with no with: mapping" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
Y
  assert_red
  assert_output_contains 'without node-version-file: .nvmrc'
  assert_output_contains 'jobs.j.steps[0]'
}

@test "fails an unpinned step written as a compact flow mapping" {
  # The fail-OPEN direction of the compact-mapping gap: the step runs, and the
  # plainly-spelled steps beside it satisfied the directory-wide vacuity guard.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - { uses: actions/setup-node@v6 }
Y
  assert_red
  assert_output_contains 'without node-version-file: .nvmrc'
}

@test "fails an unpinned step whose action reference is escaped" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: "actions/setup-nod\x65@v6"
Y
  assert_red
  assert_output_contains 'without node-version-file: .nvmrc'
}

@test "fails an unpinned bare action reference" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node
Y
  assert_red
}

@test "fails a lookalike input key that only ends in the real one" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { legacy-node-version-file: .nvmrc }
Y
  assert_red
}

@test "fails when the key is spelled inside a quoted value" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { cache: 'a, node-version-file: .nvmrc,' }
Y
  assert_red
}

@test "fails a value that merely starts with the pinned file name" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc.example
Y
  assert_red
}

@test "fails a pin declared under env: rather than with:" {
  # setup-node reads its inputs from `with:` and nowhere else.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        env:
          node-version-file: .nvmrc
Y
  assert_red
}

@test "fails an unpinned step inside a flow sequence of steps" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps: [{ uses: actions/setup-node@v6 }]
Y
  assert_red
}

@test "credits a pin that follows a nested flow mapping" {
  # `[^}]*` has no notion of nesting, so an inner mapping desynchronised the old
  # entry-wise walk and the pin behind it went unseen — a false rejection of a
  # step a runner pins correctly.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { extra: { a: 1 }, node-version-file: .nvmrc }
Y
  assert_green
}

@test "credits a pin that follows a flow sequence value" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { cache: [a, b], node-version-file: .nvmrc }
Y
  assert_green
}

@test "credits a flow mapping spread across several lines" {
  # A flow collection is not line-bounded. The old scanner required the whole
  # mapping to close on the line its key opened, so this well-formed step read as
  # unpinned.
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: {
          node-version-file: .nvmrc
        }
Y
  assert_green
}

# --- A second declaration of the version ------------------------------------------

@test "fails a literal node-version beside a correct pin" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { node-version: '20', node-version-file: .nvmrc }
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal nested one mapping deeper" {
  # A known blind spot of the line-based scanner: `[^}]*` has no notion of nesting,
  # so the inner mapping was invisible and the outer pin credited the step.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { outer: { node-version: '20' }, node-version-file: .nvmrc }
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal spelled with a quoted key" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          "node-version": '20'
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal spelled with a numeric YAML escape" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { "node-versio\x6E": '20', node-version-file: .nvmrc }
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal declared outside any step" {
  # The rule is document-wide on purpose: a `strategy.matrix.node-version` drives
  # setup-node just as directly as an input does, and a literal parked in an
  # `env:` is a second source of truth waiting to be wired up.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22]
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'jobs.j.strategy.matrix'
}

@test "fails a literal declared at the top level of the document" {
  write_probe <<'Y'
name: f
on: [push]
node-version: '20'
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal hidden behind a flow sequence value" {
  # A `[a, b]` value has no place in a `key: value,` alternation, so the walk gave
  # up at it and everything after — including this literal — became invisible.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { node-version-file: .nvmrc, cache: [a, b], node-version: "20" }
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal hidden behind a nested flow mapping" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with: { node-version-file: .nvmrc, extra: { a: 1 }, node-version: "20" }
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

@test "fails a literal written in explicit-key syntax" {
  # `? key` / `: value` is the long form of the same mapping entry. It carries no
  # `key:` token at all, so no line-anchored pattern can ever see it.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          ? node-version
          : "20"
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'pins a literal node-version'
}

# --- The unreviewable repository variable ------------------------------------------

@test "fails a workflow that reads vars.NODE_VERSION from env:" {
  write_probe <<'Y'
name: f
on: [push]
env:
  N: ${{ vars.NODE_VERSION }}
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
}

@test "fails a read from inside a run: body" {
  # The body is shell, and GitHub substitutes `${{ }}` into it before any shell
  # sees it — so a `#` line there is a real read, not a comment this gate may drop.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - run: |
          # honour ${{ vars.NODE_VERSION }}
          echo hi
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
}

@test "fails the bracket spelling of the same variable" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    if: ${{ vars['NODE_VERSION'] != '' }}
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
}

@test "fails a read spelled in a mapping key" {
  # GitHub expands `${{ }}` on both sides of a mapping entry. The scanner this
  # replaced caught a key-position read for free by testing the whole raw line,
  # so a walk that only visits values would have lost that silently.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
      - run: echo hi
        env:
          ${{ vars.NODE_VERSION }}: '1'
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
  assert_output_contains '(key)'
}

@test "fails a read from a step name" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - name: node ${{ vars.NODE_VERSION }}
        uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
}

# --- Fail-closed on anything the gate cannot read -----------------------------------

@test "fails a mixed-case action reference that is unpinned" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: ACTIONS/SETUP-NODE@v6
Y
  assert_red
  assert_output_contains 'without node-version-file: .nvmrc'
}

@test "fails a step whose uses: is not a string" {
  # GitHub resolves an action from a string and nothing else, so such a step runs
  # nothing — but the shape also hides the reference from every rule above, which
  # is the fail-open direction, so it is refused rather than ignored.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses:
          - actions/setup-node@v6
Y
  assert_red
  assert_output_contains 'declares a non-string `uses:`'
}

@test "does not refuse a step whose uses: is an ordinary string" {
  write_probe <<'Y'
name: p
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v6
        with:
          node-version-file: .nvmrc
Y
  assert_green
}

@test "fails an unparseable workflow rather than skipping it" {
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
       with:
          node-version-file: .nvmrc
Y
  assert_red
  assert_output_contains 'is not valid YAML'
}

@test "fails an implicit key continued across a line break" {
  # YAML restricts an implicit mapping key to a single line, so this is not the
  # key `node-version-file` — it is a parse error, and the gate says so.
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
        with:
          "node-version-\
           file": .nvmrc
Y
  assert_red
  assert_output_contains 'is not valid YAML'
}

@test "reads .yaml workflows as well as .yml" {
  # GitHub honours both extensions, so scanning only one lets a workflow
  # introduce a literal pin without ever failing this gate.
  cat > "$FIXTURE/.github/workflows/probe.yaml" <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
Y
  assert_red
  assert_output_contains 'probe.yaml'
}

@test "fails rather than passing vacuously with no setup-node step anywhere" {
  # Every per-step rule is conditional on finding a step. This is the one
  # assertion that a step was found at all — without it, deleting the last
  # setup-node call would turn the gate green forever.
  rm "$FIXTURE/.github/workflows/zz-baseline.yml"
  write_probe <<'Y'
name: f
on: [push]
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - run: echo hi
Y
  assert_red
  assert_output_contains 'would pass vacuously'
}

@test "fails an empty workflow directory rather than reporting a clean run" {
  # A directory holding no workflow files is the vacuity failure one step earlier
  # than "no setup-node step": there is nothing at all left to check.
  rm -f "$FIXTURE"/.github/workflows/*.yml
  assert_red
  assert_output_contains 'holds no workflow files'
}

@test "fails when the workflow directory is missing" {
  rm -rf "$FIXTURE/.github/workflows"
  assert_red
  assert_output_contains '.github/workflows is missing'
}

@test "reports every violation in one run" {
  # Collect-all-then-fail, like its sibling: a bump is fixed in a single pass
  # rather than one red run per mistake.
  write_probe <<'Y'
name: f
on: [push]
env:
  N: ${{ vars.NODE_VERSION }}
jobs:
  j:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-node@v6
      - uses: actions/setup-node@v6
        with: { node-version: '20' }
Y
  assert_red
  assert_output_contains 'reads vars.NODE_VERSION'
  assert_output_contains 'pins a literal node-version'
  assert_output_contains 'without node-version-file: .nvmrc'
}
