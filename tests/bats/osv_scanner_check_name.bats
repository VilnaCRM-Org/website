#!/usr/bin/env bats
#
# The in-repo half of the dependency-CVE branch-protection contract (issues
# #356, #379).
#
# Branch protection is repository configuration and cannot be committed. What
# the repository CAN own is the check name a `main` ruleset has to require:
# `dependency cve gate`, the `name:` of the `osv-diff` job in osv-scanner.yml.
# GitHub keys a required status check on that string, so renaming the job
# renames the check run and the ruleset silently stops requiring anything —
# exactly the drift tests/bats/security_workflows.bats already pins for the
# `Analyze (typescript)` check. This file does the same for the SCA gate, and
# holds CONTRIBUTING.md and SECURITY.md to the name the workflow declares.
#
# Every assertion reads the workflow through a YAML parser rather than a text
# scan (CLAUDE.md, issue #447): the same string inside a comment must not be
# able to satisfy it.

load './test_helper.bash'

WORKFLOW="$PROJECT_ROOT/.github/workflows/osv-scanner.yml"
REQUIRED_CHECK='dependency cve gate'

# Print the `name:` of job $2 in workflow $1, or '-' when the job has none.
check_name_of() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const job = (doc.jobs || {})[process.argv[2]];
    process.stdout.write((job && job.name ? job.name : "-") + "\n");
  ' "$1" "$2"
}

# Print the `if:` expression of job $2 in workflow $1, or '-' when absent.
job_condition_of() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const job = (doc.jobs || {})[process.argv[2]];
    process.stdout.write((job && job.if ? String(job.if) : "-") + "\n");
  ' "$1" "$2"
}

# Exit 0 when the workflow declares a pull_request trigger targeting main.
# `on` parses as a plain string key under js-yaml's default (YAML 1.2) schema.
triggers_on_pull_request_to_main() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const pr = doc.on && doc.on.pull_request;
    const branches = (pr && pr.branches) || [];
    process.exit(branches.includes("main") ? 0 : 1);
  ' "$1"
}

setup() {
  export PROJECT_ROOT
}

# --- Positive: the check name and its wiring -----------------------------------

@test "the osv-diff job still produces the required 'dependency cve gate' check name" {
  [ "$(check_name_of "$WORKFLOW" osv-diff)" = "$REQUIRED_CHECK" ]
}

@test "the gate job is the pull-request leg of a workflow that runs on pull requests to main" {
  # A required check that never runs on the pull request is a check GitHub
  # reports as "expected" forever: the ruleset would block every merge, not
  # gate it.
  triggers_on_pull_request_to_main "$WORKFLOW"
  [[ "$(job_condition_of "$WORKFLOW" osv-diff)" == *"github.event_name == 'pull_request'"* ]]
}

@test "no other job in the workflow claims the same check name" {
  # Two jobs with one name would make the required check ambiguous, and the
  # census leg runs off-PR and must never be mistaken for the gate.
  local count
  count="$(node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const names = Object.values(doc.jobs || {}).map((j) => j.name);
    process.stdout.write(String(names.filter((n) => n === process.argv[2]).length));
  ' "$WORKFLOW" "$REQUIRED_CHECK")"
  [ "$count" -eq 1 ]
}

@test "CONTRIBUTING.md and SECURITY.md name the check exactly as the workflow declares it" {
  # The docs tell a maintainer what string to type into the ruleset. They are
  # held to the workflow, not to this file's constant, so the three can only
  # move together.
  local declared
  declared="$(check_name_of "$WORKFLOW" osv-diff)"
  grep -F -q "\`$declared\`" "$PROJECT_ROOT/CONTRIBUTING.md"
  grep -F -q "\`$declared\`" "$PROJECT_ROOT/SECURITY.md"
}

# --- Negative: a rename is detected, and a comment cannot mask it -------------

@test "detects the gate job renamed, even when a comment still carries the old name" {
  local mutated="$BATS_TEST_TMPDIR/renamed.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    doc.jobs["osv-diff"].name = "dependency cve scan";
    fs.writeFileSync(
      process.argv[2],
      "# name: dependency cve gate (old)\n" + yaml.dump(doc)
    );
  ' "$WORKFLOW" "$mutated"

  # The comment is there to fool a text scan...
  run grep -c 'name: dependency cve gate' "$mutated"
  [ "$output" -ge 1 ]
  # ...and the parser is not fooled.
  [ "$(check_name_of "$mutated" osv-diff)" != "$REQUIRED_CHECK" ]
}

@test "detects the gate job losing its pull-request condition" {
  local mutated="$BATS_TEST_TMPDIR/unconditional.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    delete doc.jobs["osv-diff"].if;
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$WORKFLOW" "$mutated"

  [ "$(job_condition_of "$mutated" osv-diff)" = '-' ]
}

@test "detects the pull_request trigger dropped from the workflow" {
  local mutated="$BATS_TEST_TMPDIR/no-pr-trigger.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    delete doc.on.pull_request;
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$WORKFLOW" "$mutated"

  run triggers_on_pull_request_to_main "$mutated"
  [ "$status" -ne 0 ]
}
