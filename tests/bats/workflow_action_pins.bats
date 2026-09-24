#!/usr/bin/env bats
#
# Every `uses:` in the repository must name an immutable commit (issue #375, F3).
#
# A tag or branch can be repointed upstream, and autorelease.yml (release App
# key, `contents: write`) and deploy.yml (prod deploy role) sit on the path that
# auto-ships `main`. zizmor (make lint-workflows) also reports unpinned refs, but
# only through its policy defaults at a severity threshold, and a `docker://` tag
# falls below that threshold; this gate states the rule itself, parses every
# document with js-yaml (a SHA in a trailing comment is not the ref), and needs no
# Docker or network.
#
# Scenario classes:
#   - Positive: the committed tree, and a fixture using each accepted form,
#     including a `$/<path>` self-repository reference (GitHub's immutable
#     same-repo syntax, resolved at the running commit like `./`).
#   - Negative: tag, branch, short sha, unpinned image, reusable-workflow and
#     composite refs, a tag ref inside a local action outside .github/actions, a
#     `./` ref that is missing or escapes the tree, a `$/` ref carrying an
#     `@ref` suffix (not valid for that syntax), disguised spellings, an
#     unparsable or non-mapping document.
#   - Boundary: 39/41/upper-case hex, an empty glob, a `.yaml` workflow.
#   Not applicable: loading, retry, timeout and async states — a synchronous scan
#   of committed files with no async boundary.

load './test_helper.bash'

SHA40="0123456789abcdef0123456789abcdef01234567"
HEX64="deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef"

# Scan the repository tree rooted at $1: every workflow, every action under
# .github/actions, and every local action a `./` ref reaches from those, wherever
# it lives. Prints `unpinned|<file>|<where>|<uses>` for every violation,
# `error|<file>|<reason>` for a document that cannot be read as a workflow or
# action or a `./` ref with no action behind it, and a closing `scanned <files>
# files, <refs> uses` summary. Exits non-zero on any violation, any error, or no
# files at all.
scan_action_pins() {
  PROJECT_ROOT="$PROJECT_ROOT" SCAN_ROOT="$1" node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const path = require("path");
    const root = path.resolve(process.env.SCAN_ROOT);
    const PINNED = [
      /^\.\/\S*$/,
      /^\$\/[^\s@]+$/,
      /^docker:\/\/[^\s@]+@sha256:[0-9a-f]{64}$/,
      /^[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*@[0-9a-f]{40}$/,
    ];
    let failed = false;
    let refs = 0;
    const report = (line) => { failed = true; process.stdout.write(line + "\n"); };
    const error = (file, reason) => report("error|" + file + "|" + reason);
    const isMapping = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

    const list = (dir, match, recurse) => {
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return recurse ? list(full, match, recurse) : [];
        return match.test(entry.name) ? [full] : [];
      }).sort();
    };

    const workflows = list(path.join(root, ".github/workflows"), /\.ya?ml$/, false);
    const actions = list(path.join(root, ".github/actions"), /^action\.ya?ml$/, true);
    const queue = workflows.concat(actions);
    const seen = new Set(queue);
    const workflowSet = new Set(workflows);
    const follow = (file, ref) => {
      const target = path.resolve(root, ref);
      const rel = path.relative(root, target);
      if (rel === ".." || rel.startsWith(".." + path.sep) || path.isAbsolute(rel)) {
        return error(file, "local action " + ref + " is outside the repository");
      }
      if (workflowSet.has(target)) return;
      const metadata = ["action.yml", "action.yaml"]
        .map((name) => path.join(target, name))
        .filter((f) => fs.existsSync(f) && fs.statSync(f).isFile());
      if (metadata.length === 0) return error(file, "local action " + ref + " not found");
      for (const m of metadata) {
        if (!seen.has(m)) { seen.add(m); queue.push(m); }
      }
    };

    const check = (file, where, value) => {
      refs += 1;
      if (typeof value !== "string" || !PINNED.some((re) => re.test(value))) {
        return report("unpinned|" + file + "|" + where + "|" + JSON.stringify(value));
      }
      if (value.startsWith("./")) follow(file, value);
      else if (value.startsWith("$/")) follow(file, "./" + value.slice(2));
    };
    const checkSteps = (file, prefix, steps) => {
      if (steps === undefined) return;
      if (!Array.isArray(steps)) return error(file, prefix + " steps is not a list");
      steps.forEach((step, i) => {
        if (isMapping(step) && "uses" in step) check(file, prefix + ".steps[" + i + "]", step.uses);
      });
    };

    if (queue.length === 0) {
      process.stdout.write("error|" + root + "|no workflow or action files found\n");
      process.exit(1);
    }

    for (let i = 0; i < queue.length; i += 1) {
      const full = queue[i];
      const file = path.relative(root, full);
      let doc;
      try {
        doc = yaml.load(fs.readFileSync(full, "utf8"));
      } catch (err) {
        error(file, String(err.message).split("\n")[0]);
        continue;
      }
      if (!isMapping(doc)) { error(file, "not a mapping"); continue; }
      if (workflowSet.has(full)) {
        if (!isMapping(doc.jobs)) { error(file, "no jobs mapping"); continue; }
        for (const [id, job] of Object.entries(doc.jobs)) {
          if (!isMapping(job)) { error(file, "job " + id + " is not a mapping"); continue; }
          if ("uses" in job) check(file, "jobs." + id, job.uses);
          checkSteps(file, "jobs." + id, job.steps);
        }
      } else {
        if (!isMapping(doc.runs)) { error(file, "no runs mapping"); continue; }
        checkSteps(file, "runs", doc.runs.steps);
        const image = doc.runs.image;
        if (typeof image === "string" && image.startsWith("docker://")) {
          check(file, "runs.image", image);
        }
      }
    }
    process.stdout.write("scanned " + queue.length + " files, " + refs + " uses\n");
    process.exit(failed ? 1 : 0);
  '
}

setup() {
  FIXTURE="$BATS_TEST_TMPDIR/repo"
  mkdir -p "$FIXTURE/.github/workflows"
}

# Write a one-job workflow whose steps are the remaining arguments, one per line.
write_workflow() {
  local name="$1"
  shift
  {
    printf 'name: fixture\non: [pull_request]\npermissions: {}\njobs:\n'
    printf '  build:\n    runs-on: ubuntu-latest\n    steps:\n'
    printf '      %s\n' "$@"
  } > "$FIXTURE/.github/workflows/$name"
}

@test "every uses in the committed workflows and actions is pinned to a commit" {
  run scan_action_pins "$PROJECT_ROOT"

  [ "$status" -eq 0 ]
  [[ "$output" =~ scanned\ ([0-9]+)\ files,\ ([0-9]+)\ uses ]]
  [ "${BASH_REMATCH[1]}" -gt 1 ]
  [ "${BASH_REMATCH[2]}" -gt 0 ]
}

@test "the committed composite action is scanned, not only the workflows" {
  local actions
  actions="$(find "$PROJECT_ROOT/.github/actions" -name 'action.y*ml' | wc -l)"
  [ "$actions" -gt 0 ]

  mkdir -p "$FIXTURE/.github/actions"
  cp -R "$PROJECT_ROOT/.github/actions/." "$FIXTURE/.github/actions/"
  rm -rf "$FIXTURE/.github/workflows"
  run scan_action_pins "$FIXTURE"

  [ "$status" -eq 0 ]
  [[ "$output" == *"scanned $actions files"* ]]
}

@test "a full sha, a local action and a digest-pinned image all pass" {
  mkdir -p "$FIXTURE/.github/actions/dev-container"
  printf '%s\n' 'name: dev' 'description: fixture' 'runs:' '  using: composite' \
    '  steps:' '    - run: "true"' '      shell: bash' \
    > "$FIXTURE/.github/actions/dev-container/action.yml"
  write_workflow pinned.yml \
    "- uses: actions/checkout@$SHA40 # v6.0.2" \
    "- uses: github/codeql-action/init@$SHA40" \
    "- uses: ./.github/actions/dev-container" \
    "- uses: docker://ghcr.io/org/tool:1.2@sha256:$HEX64" \
    "- run: 'echo uses: actions/checkout@v4'"

  run scan_action_pins "$FIXTURE"

  [ "$status" -eq 0 ]
  [[ "$output" == *"scanned 2 files, 4 uses"* ]]
}

@test "a \$/ self-repository reference without an @ suffix passes and is followed" {
  mkdir -p "$FIXTURE/.github/actions/dev-container"
  printf '%s\n' 'name: dev' 'description: fixture' 'runs:' '  using: composite' \
    '  steps:' "    - uses: actions/checkout@$SHA40" \
    > "$FIXTURE/.github/actions/dev-container/action.yml"
  write_workflow selfref.yml '- uses: $/.github/actions/dev-container'

  run scan_action_pins "$FIXTURE"

  [ "$status" -eq 0 ]
  [[ "$output" == *"scanned 2 files, 2 uses"* ]]
}

@test "a \$/ self-repository reference carrying an @ suffix fails" {
  write_workflow selfref-ref.yml '- uses: $/.github/actions/dev-container@main'

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'unpinned|.github/workflows/selfref-ref.yml|jobs.build.steps[0]|"$/.github/actions/dev-container@main"'* ]]
}

@test "a tag ref fails" {
  write_workflow tag.yml "- uses: actions/checkout@v4"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'unpinned|.github/workflows/tag.yml|jobs.build.steps[0]|'* ]]
  [[ "$output" == *'|"actions/checkout@v4"'* ]]
}

@test "a branch ref fails even when a sha sits in its trailing comment" {
  write_workflow branch.yml "- uses: vendor/action@main # $SHA40"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'|"vendor/action@main"'* ]]
}

@test "a reusable workflow called by tag at job level fails" {
  printf '%s\n' 'name: fixture' 'on: [pull_request]' 'jobs:' '  call:' \
    '    uses: org/repo/.github/workflows/release.yml@v1' \
    > "$FIXTURE/.github/workflows/reusable.yml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'|jobs.call|"org/repo/.github/workflows/release.yml@v1"'* ]]
}

@test "a composite action step with a tag ref fails" {
  write_workflow ok.yml "- uses: ./.github/actions/setup"
  mkdir -p "$FIXTURE/.github/actions/setup"
  printf '%s\n' 'name: setup' 'description: fixture' 'runs:' '  using: composite' \
    '  steps:' "    - uses: actions/cache@$SHA40" '    - uses: vendor/thing@v2' \
    > "$FIXTURE/.github/actions/setup/action.yml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'unpinned|.github/actions/setup/action.yml|runs.steps[1]|"vendor/thing@v2"'* ]]
  [[ "$output" != *"actions/cache"* ]]
}

@test "a local action outside .github/actions is followed and its tag ref fails" {
  write_workflow ok.yml "- uses: ./tools/setup/"
  mkdir -p "$FIXTURE/tools/setup"
  printf '%s\n' 'name: setup' 'description: fixture' 'runs:' '  using: composite' \
    '  steps:' '    - uses: ./scripts/nested' \
    > "$FIXTURE/tools/setup/action.yml"
  mkdir -p "$FIXTURE/scripts/nested"
  printf '%s\n' 'name: nested' 'description: fixture' 'runs:' '  using: composite' \
    '  steps:' '    - uses: vendor/evil@v1' \
    > "$FIXTURE/scripts/nested/action.yaml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'unpinned|scripts/nested/action.yaml|runs.steps[0]|"vendor/evil@v1"'* ]]
  [[ "$output" == *"scanned 3 files, 3 uses"* ]]
}

@test "a local ref with no action behind it fails instead of passing unscanned" {
  write_workflow missing.yml "- uses: ./tools/absent" "- uses: ./.github/workflows/absent.yml"
  mkdir -p "$FIXTURE/tools/absent"
  printf 'FROM scratch\n' > "$FIXTURE/tools/absent/Dockerfile"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'error|.github/workflows/missing.yml|local action ./tools/absent not found'* ]]
  [[ "$output" == *'|local action ./.github/workflows/absent.yml not found'* ]]
}

@test "a local ref that escapes the repository fails" {
  write_workflow escape.yml "- uses: ./../outside"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'|local action ./../outside is outside the repository'* ]]
}

@test "a local reusable workflow is accepted without being scanned twice" {
  write_workflow called.yml "- uses: actions/checkout@$SHA40"
  printf '%s\n' 'name: caller' 'on: [pull_request]' 'jobs:' '  call:' \
    '    uses: ./.github/workflows/called.yml' \
    > "$FIXTURE/.github/workflows/caller.yml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -eq 0 ]
  [[ "$output" == *"scanned 2 files, 2 uses"* ]]
}

@test "a docker action image pulled by tag fails" {
  write_workflow ok.yml "- uses: ./.github/actions/tool"
  mkdir -p "$FIXTURE/.github/actions/tool"
  printf '%s\n' 'name: tool' 'description: fixture' 'runs:' '  using: docker' \
    "  image: docker://alpine:3.20" > "$FIXTURE/.github/actions/tool/action.yaml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'|runs.image|"docker://alpine:3.20"'* ]]
}

@test "a docker step without a digest, or with a short one, fails" {
  write_workflow docker.yml "- uses: docker://alpine:3.20" \
    "- uses: docker://alpine@sha256:${HEX64:0:63}"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'steps[0]|"docker://alpine:3.20"'* ]]
  [[ "$output" == *'steps[1]|"docker://alpine@sha256:'* ]]
}

@test "a short, over-long or upper-case sha fails" {
  write_workflow hex.yml \
    "- uses: actions/checkout@${SHA40:0:7}" \
    "- uses: actions/checkout@${SHA40:0:39}" \
    "- uses: actions/checkout@${SHA40}0" \
    "- uses: actions/checkout@0123456789ABCDEF0123456789ABCDEF01234567"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [ "$(grep -c '^unpinned|' <<<"$output")" -eq 4 ]
}

@test "flow-mapping and quoted-key spellings of an unpinned ref still fail" {
  write_workflow disguised.yml \
    "- { name: checkout, uses: actions/checkout@v4 }" \
    "- \"uses\": 'actions/setup-node@v6'" \
    "- name: \"uses: actions/cache@$SHA40\"" \
    "  uses: actions/cache@v5"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [ "$(grep -c '^unpinned|' <<<"$output")" -eq 3 ]
}

@test "a workflow in a .yaml file is scanned too" {
  write_workflow deploy.yaml "- uses: aws-actions/configure-aws-credentials@v4"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'.github/workflows/deploy.yaml|'* ]]
}

@test "a workflow the parser cannot read fails instead of passing unscanned" {
  write_workflow ok.yml "- uses: actions/checkout@$SHA40"
  printf 'name: broken\njobs:\n  j:\n    steps: [\n' > "$FIXTURE/.github/workflows/broken.yml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'error|.github/workflows/broken.yml|'* ]]
}

@test "an empty or job-less workflow fails instead of passing unscanned" {
  : > "$FIXTURE/.github/workflows/empty.yml"
  printf 'name: nojobs\non: [push]\n' > "$FIXTURE/.github/workflows/nojobs.yml"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *'error|.github/workflows/empty.yml|not a mapping'* ]]
  [[ "$output" == *'error|.github/workflows/nojobs.yml|no jobs mapping'* ]]
}

@test "a tree with no workflow or action files fails rather than passing vacuously" {
  printf 'not a workflow\n' > "$FIXTURE/.github/workflows/README.md"

  run scan_action_pins "$FIXTURE"

  [ "$status" -ne 0 ]
  [[ "$output" == *"no workflow or action files found"* ]]
}
