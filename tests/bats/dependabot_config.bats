#!/usr/bin/env bats
#
# Coverage for .github/dependabot.yml's security-update stream (issue #341).
#
# The stalled-refresh problem #341 records is not "Dependabot is unconfigured" —
# it is that a CVE fix was folded into the monthly grouped feature-bump PR. The
# fix is a SECOND GROUP on the existing bun entry, scoped with
# `applies-to: security-updates`, so an advisory is raised as its own PR.
#
# `applies-to` is a key of a `groups` entry. GitHub's Dependabot options
# reference documents it nowhere else, so the same key written directly on an
# `updates` entry is simply not read — an earlier revision of this file did that
# on a duplicate bun `/` entry and shipped a stream GitHub never had. Hence the
# two structural assertions below: no `updates` entry may carry `applies-to`,
# and there may be exactly one bun entry for '/'.
#
# Every assertion reads the file through a YAML parser. This repository bans
# regex-scanning of config YAML (CLAUDE.md, issue #447): a `grep 'applies-to'`
# here could not tell a real key from the same text inside this file's own
# comments.

load './test_helper.bash'

DEPENDABOT="$PROJECT_ROOT/.github/dependabot.yml"

# One pipe-delimited row per update block:
#   ecosystem|directories|entry-level-applies-to|interval|limit|labels|prefix
entries() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    for (const u of doc.updates) {
      const dirs = u.directories || [u.directory];
      process.stdout.write([
        u["package-ecosystem"],
        dirs.join(","),
        "applies-to" in u ? u["applies-to"] : "-",
        u.schedule && u.schedule.interval,
        u["open-pull-requests-limit"],
        (u.labels || []).join(","),
        u["commit-message"] && u["commit-message"].prefix,
      ].join("|") + "\n");
    }
  ' "$1"
}

# One row per group of the given ecosystem: ecosystem|group-name|applies-to
groups_of() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    for (const u of doc.updates) {
      if (u["package-ecosystem"] !== process.argv[2]) continue;
      for (const [name, g] of Object.entries(u.groups || {})) {
        process.stdout.write(
          [u["package-ecosystem"], name, g["applies-to"] || "version-updates"].join("|") + "\n"
        );
      }
    }
  ' "$1" "$2"
}

# The invariant a "collapse" regression breaks: the bun entry still carries a
# group that handles ordinary version updates.
assert_version_group_intact() {
  local rows="$1"
  if ! printf '%s\n' "$rows" | grep -q '^bun|.*|version-updates$'; then
    echo 'Expected a bun group with applies-to: version-updates' >&2
    printf '%s\n' "$rows" >&2
    return 1
  fi
}

assert_security_group_present() {
  local rows="$1"
  if ! printf '%s\n' "$rows" | grep -q '^bun|.*|security-updates$'; then
    echo 'Expected a bun group with applies-to: security-updates' >&2
    printf '%s\n' "$rows" >&2
    return 1
  fi
}

setup() {
  export PROJECT_ROOT
}

# --- Positive: the security stream exists in the shape GitHub honours ----------

@test "the bun entry declares a security-updates group" {
  run groups_of "$DEPENDABOT" bun
  [ "$status" -eq 0 ]
  assert_security_group_present "$output"
}

@test "the bun entry keeps an explicit version-updates group" {
  # Explicit rather than defaulted, so neither group's scope is implicit once a
  # sibling group narrows the other half.
  local rows
  rows="$(groups_of "$DEPENDABOT" bun)"
  assert_version_group_intact "$rows"
  # And it is spelled out in the file, not inferred by this helper's fallback.
  run node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    const scopes = Object.values(bun.groups).map((g) => g["applies-to"]);
    if (scopes.some((s) => s === undefined)) {
      console.error("a bun group leaves applies-to implicit: " + JSON.stringify(scopes));
      process.exit(1);
    }
  ' "$DEPENDABOT"
  [ "$status" -eq 0 ]
}

# --- Positive: the unsupported shape this fix removed must not come back ------

@test "no updates entry carries applies-to, which is a groups-only key" {
  local rows
  rows="$(entries "$DEPENDABOT")"
  # Column 3 is the entry-level `applies-to`; '-' means the key is absent.
  if printf '%s\n' "$rows" | cut -d'|' -f3 | grep -qv '^-$'; then
    echo 'An updates entry carries applies-to; GitHub ignores it there' >&2
    printf '%s\n' "$rows" >&2
    return 1
  fi
}

@test "there is exactly one bun entry for the root directory" {
  local rows count
  rows="$(entries "$DEPENDABOT")"
  count="$(printf '%s\n' "$rows" | grep -c '^bun|/|')"
  [ "$count" -eq 1 ]
}

# --- Positive: the three version-updates blocks survive ------------------------

@test "the bun, github-actions and docker entries are preserved with their cadence" {
  local rows
  rows="$(entries "$DEPENDABOT")"
  printf '%s\n' "$rows" | grep -q '^bun|/|-|monthly|2|'
  printf '%s\n' "$rows" | grep -q '^github-actions|/|-|weekly|5|'
  printf '%s\n' "$rows" | grep -q '^docker|/,/src/test/load|-|weekly|5|'
}

@test "every entry uses the same commit-message prefix" {
  local prefixes
  prefixes="$(entries "$DEPENDABOT" | cut -d'|' -f7 | sort -u)"
  [ "$prefixes" = 'deps' ]
}

@test "the bun entry carries the dependencies and automated labels" {
  local labels
  labels="$(entries "$DEPENDABOT" | grep '^bun|' | cut -d'|' -f6)"
  [[ "$labels" == *dependencies* ]]
  [[ "$labels" == *automated* ]]
}

# --- Negative: each regression must be detected --------------------------------

@test "detects the security group being removed" {
  local mutated="$BATS_TEST_TMPDIR/removed.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    for (const [name, g] of Object.entries(bun.groups)) {
      if (g["applies-to"] === "security-updates") delete bun.groups[name];
    }
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(groups_of "$mutated" bun)"
  run assert_security_group_present "$rows"
  [ "$status" -ne 0 ]
}

@test "detects the version-updates group collapsed into the security scope" {
  # The regression: rather than a sibling group, the existing group's scope is
  # narrowed to security-updates. A security stream still exists, so a naive
  # presence check stays green while feature updates have silently stopped.
  local mutated="$BATS_TEST_TMPDIR/collapsed.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    for (const g of Object.values(bun.groups)) g["applies-to"] = "security-updates";
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(groups_of "$mutated" bun)"
  # The security stream is still there...
  assert_security_group_present "$rows"
  # ...but the invariant that matters is red.
  run assert_version_group_intact "$rows"
  [ "$status" -ne 0 ]
}

@test "detects applies-to moved back onto an updates entry" {
  # The exact defect this file's history records: a duplicate bun '/' entry
  # carrying an entry-level `applies-to`, a key GitHub does not read there.
  local mutated="$BATS_TEST_TMPDIR/entry-level.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    doc.updates.push({
      "package-ecosystem": "bun",
      directory: "/",
      "applies-to": "security-updates",
      schedule: bun.schedule,
    });
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(entries "$mutated")"
  # Both structural guards go red on it: the unsupported key...
  printf '%s\n' "$rows" | cut -d'|' -f3 | grep -q '^security-updates$'
  # ...and the duplicated bun '/' entry.
  [ "$(printf '%s\n' "$rows" | grep -c '^bun|/|')" -eq 2 ]
}

# --- Negative: the parser, not a text scan, is what decides --------------------

@test "a commented-out security group does not satisfy the presence check" {
  # Guards the assertions above against being satisfied by the file's own prose:
  # every occurrence of the string in a comment is invisible to js-yaml, which is
  # exactly why this suite parses instead of grepping.
  local mutated="$BATS_TEST_TMPDIR/commented.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    for (const [name, g] of Object.entries(bun.groups)) {
      if (g["applies-to"] === "security-updates") delete bun.groups[name];
    }
    fs.writeFileSync(
      process.argv[2],
      yaml.dump(doc) + "\n# applies-to: security-updates (disabled)\n"
    );
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(groups_of "$mutated" bun)"
  run assert_security_group_present "$rows"
  [ "$status" -ne 0 ]
  run grep -c 'applies-to: security-updates' "$mutated"
  [ "$output" -ge 1 ]
}
