#!/usr/bin/env bats
#
# Coverage for .github/dependabot.yml's security-update stream (issue #341).
#
# The stalled-refresh problem #341 records is not "Dependabot is unconfigured" —
# it is that a CVE fix had to queue behind monthly grouped feature bumps under an
# `open-pull-requests-limit` of 2. The fix is a FOURTH block that carries only
# security advisories, weekly, at a higher limit. Two regressions would silently
# undo it: deleting that block, and "simplifying" the file by moving
# `applies-to: security-updates` onto an existing block — which converts a
# version-updates stream into a security one and stops feature bumps entirely,
# while still leaving a security stream present.
#
# So the assertions below check both directions, and every one of them reads the
# file through a YAML parser. This repository bans regex-scanning of workflow
# YAML (CLAUDE.md, issue #447): a `grep 'applies-to'` here could not tell a real
# key from the same text inside this file's own comments.

load './test_helper.bash'

DEPENDABOT="$PROJECT_ROOT/.github/dependabot.yml"

# Emit one pipe-delimited row per update block, parsed with js-yaml:
#   ecosystem|applies-to|interval|limit|labels|commit-prefix|grouped
summarize() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    for (const u of doc.updates) {
      process.stdout.write([
        u["package-ecosystem"],
        u["applies-to"] || "version-updates",
        u.schedule && u.schedule.interval,
        u["open-pull-requests-limit"],
        (u.labels || []).join(","),
        u["commit-message"] && u["commit-message"].prefix,
        u.groups ? "grouped" : "ungrouped",
      ].join("|") + "\n");
    }
  ' "$1"
}

# The invariant a "collapse" regression breaks: every ecosystem that had a
# version-updates stream still has one.
assert_version_streams_intact() {
  local rows="$1"
  local ecosystem
  for ecosystem in bun github-actions docker; do
    if ! printf '%s\n' "$rows" | grep -q "^${ecosystem}|version-updates|"; then
      echo "Expected a version-updates stream for '$ecosystem'" >&2
      printf '%s\n' "$rows" >&2
      return 1
    fi
  done
}

setup() {
  export PROJECT_ROOT
}

# --- Positive: the security stream exists and is shaped as #341 requires -------

@test "declares a bun security-updates stream" {
  run summarize "$DEPENDABOT"
  [ "$status" -eq 0 ]
  assert_output_contains 'bun|security-updates|'
}

@test "the security stream is weekly, not monthly" {
  local row
  row="$(summarize "$DEPENDABOT" | grep '^bun|security-updates|')"
  [ "$(printf '%s' "$row" | cut -d'|' -f3)" = 'weekly' ]
}

@test "the security stream carries the dependencies, security and automated labels" {
  local labels
  labels="$(summarize "$DEPENDABOT" | grep '^bun|security-updates|' | cut -d'|' -f5)"
  [[ "$labels" == *dependencies* ]]
  [[ "$labels" == *security* ]]
  [[ "$labels" == *automated* ]]
}

@test "the security stream uses the same commit-message prefix as the other blocks" {
  local rows prefixes
  rows="$(summarize "$DEPENDABOT")"
  prefixes="$(printf '%s\n' "$rows" | cut -d'|' -f6 | sort -u)"
  [ "$prefixes" = 'deps' ]
}

@test "the security stream is ungrouped so one advisory is one reviewable PR" {
  local row
  row="$(summarize "$DEPENDABOT" | grep '^bun|security-updates|')"
  [ "$(printf '%s' "$row" | cut -d'|' -f7)" = 'ungrouped' ]
}

# --- Boundary: the limit must be strictly higher than the version-updates one --

@test "the security PR limit is strictly higher than the bun version-updates limit" {
  local rows security version
  rows="$(summarize "$DEPENDABOT")"
  security="$(printf '%s\n' "$rows" | grep '^bun|security-updates|' | cut -d'|' -f4)"
  version="$(printf '%s\n' "$rows" | grep '^bun|version-updates|' | cut -d'|' -f4)"
  [ -n "$security" ]
  [ -n "$version" ]
  [ "$security" -gt "$version" ]
}

# --- Positive: the three pre-existing version-updates blocks survive -----------

@test "the bun, github-actions and docker version-updates streams are preserved" {
  local rows
  rows="$(summarize "$DEPENDABOT")"
  assert_version_streams_intact "$rows"
}

@test "adding the security stream did not change the existing blocks' cadence" {
  local rows
  rows="$(summarize "$DEPENDABOT")"
  printf '%s\n' "$rows" | grep -q '^bun|version-updates|monthly|2|'
  printf '%s\n' "$rows" | grep -q '^github-actions|version-updates|weekly|5|'
  printf '%s\n' "$rows" | grep -q '^docker|version-updates|weekly|5|'
}

# --- Negative: the collapse regression must be detected ------------------------

@test "detects a bun version-updates block collapsed into the security stream" {
  # The regression: instead of a fourth block, `applies-to: security-updates` is
  # moved onto the existing bun block. A security stream still exists, so a naive
  # presence check stays green while feature updates have silently stopped.
  local mutated="$BATS_TEST_TMPDIR/collapsed.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    doc.updates = doc.updates.filter(u => u["applies-to"] !== "security-updates");
    doc.updates[0]["applies-to"] = "security-updates";
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(summarize "$mutated")"
  # The security stream is still there...
  printf '%s\n' "$rows" | grep -q '^bun|security-updates|'
  # ...but the invariant that matters is red.
  run assert_version_streams_intact "$rows"
  [ "$status" -ne 0 ]
}

@test "detects the security stream being removed entirely" {
  local mutated="$BATS_TEST_TMPDIR/removed.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    doc.updates = doc.updates.filter(u => u["applies-to"] !== "security-updates");
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  run summarize "$mutated"
  [ "$status" -eq 0 ]
  refute_output_contains 'bun|security-updates|'
}

# --- Negative: the parser, not a text scan, is what decides --------------------

@test "a commented-out security stream does not satisfy the presence check" {
  # Guards the assertions above against being satisfied by the file's own prose:
  # every occurrence of the string in a comment is invisible to js-yaml, which is
  # exactly why this suite parses instead of grepping.
  local mutated="$BATS_TEST_TMPDIR/commented.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    doc.updates = doc.updates.filter(u => u["applies-to"] !== "security-updates");
    fs.writeFileSync(
      process.argv[2],
      yaml.dump(doc) + "\n# applies-to: security-updates (disabled)\n"
    );
  ' "$DEPENDABOT" "$mutated"

  run summarize "$mutated"
  [ "$status" -eq 0 ]
  refute_output_contains 'bun|security-updates|'
  run grep -c 'applies-to: security-updates' "$mutated"
  [ "$output" -ge 1 ]
}
