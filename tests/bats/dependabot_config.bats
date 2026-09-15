#!/usr/bin/env bats
#
# Coverage for .github/dependabot.yml's bun entry (issues #341, #379).
#
# Two facts shape this file, both verified against GitHub's own documentation
# and the live repository (see the comment block in the YAML):
#
# 1. GitHub ships NO Dependabot security updates for `package-ecosystem: bun`
#    (supported-ecosystems table: version updates ✓, security updates ✗), and
#    the dependency graph never parses bun.lock, so no repository setting can
#    make the `js-security-updates` group open a PR today. The group is kept
#    deliberately — inert, forward-compatible, and shaped the one way GitHub
#    honours (`applies-to` is a GROUP key; an earlier revision put it on a
#    duplicate `updates` entry and shipped a stream GitHub never had). The
#    working advisory channel is osv-scanner (#356), not this file.
#
# 2. The `*` version-update group was the live failure: 52-70-package PRs
#    (#392 .. #454) that a single major bump turned red and that never
#    merged. Version updates are now split into clusters restricted to
#    `update-types: [minor, patch]`, with a `*` catch-all declared LAST, so a
#    major matches no group and opens as its own PR. The assertions below pin
#    that shape: every version group excludes majors, the catch-all cannot
#    precede a specific group (Dependabot takes the first match), and every
#    specific group still matches something in package.json — a cluster whose
#    patterns match nothing is a silent no-op, not a cluster.
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

# One row per group of the given ecosystem AT THE GIVEN DIRECTORY:
#   ecosystem|group-name|applies-to
#
# The directory filter is load-bearing. Reading groups from every entry of the
# ecosystem would let a later, non-root bun entry carrying both groups satisfy
# the presence checks while the '/' entry lost its security group — Dependabot
# would stop protecting the root lockfile with this suite still green.
groups_of() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    for (const u of doc.updates) {
      if (u["package-ecosystem"] !== process.argv[2]) continue;
      const dirs = u.directories || (u.directory === undefined ? [] : [u.directory]);
      if (!dirs.includes(process.argv[3])) continue;
      for (const [name, g] of Object.entries(u.groups || {})) {
        process.stdout.write(
          [u["package-ecosystem"], name, g["applies-to"] || "version-updates"].join("|") + "\n"
        );
      }
    }
  ' "$1" "$2" "$3"
}

# One row per VERSION-UPDATES group of the bun '/' entry, in declaration order
# (Dependabot assigns a dependency to the first group it matches, so order is
# part of the contract, and js-yaml preserves it):
#   name|patterns|exclude-patterns|update-types
# List-valued columns are comma-joined; an absent key prints as '-'.
version_groups_of() {
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const list = (v) => (Array.isArray(v) && v.length ? v.join(",") : "-");
    for (const u of doc.updates) {
      if (u["package-ecosystem"] !== "bun") continue;
      const dirs = u.directories || (u.directory === undefined ? [] : [u.directory]);
      if (!dirs.includes("/")) continue;
      for (const [name, g] of Object.entries(u.groups || {})) {
        if ((g["applies-to"] || "version-updates") !== "version-updates") continue;
        process.stdout.write(
          [name, list(g.patterns), list(g["exclude-patterns"]), list(g["update-types"])].join("|") + "\n"
        );
      }
    }
  ' "$1"
}

# Names of the direct dependencies a group pattern can ever match: Dependabot
# version updates act on the manifest, so a pattern that matches nothing in
# package.json is dead config. Wildcards follow the options reference: `*`
# matches any run of characters, and a bare `*` matches every dependency.
direct_dependency_names() {
  node -e '
    const pkg = require(process.argv[1]);
    const names = Object.keys({ ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) });
    process.stdout.write(names.join("\n") + "\n");
  ' "$1"
}

# Exit 0 when at least one name on stdin matches one of the comma-joined
# patterns in $1 (Dependabot wildcard syntax).
patterns_match_any() {
  node -e '
    const patterns = process.argv[1].split(",");
    const names = require("fs").readFileSync(0, "utf8").split("\n").filter(Boolean);
    const toRegExp = (p) =>
      new RegExp("^" + p.split("*").map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(".*") + "$");
    const regexps = patterns.map(toRegExp);
    process.exit(names.some((n) => regexps.some((r) => r.test(n))) ? 0 : 1);
  ' "$1"
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
  run groups_of "$DEPENDABOT" bun /
  [ "$status" -eq 0 ]
  assert_security_group_present "$output"
}

@test "the bun entry keeps an explicit version-updates group" {
  # Explicit rather than defaulted, so neither group's scope is implicit once a
  # sibling group narrows the other half.
  local rows
  rows="$(groups_of "$DEPENDABOT" bun /)"
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
  printf '%s\n' "$rows" | grep -q '^bun|/|-|weekly|5|'
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

# --- Positive: version updates are split so a major cannot sink a batch --------

@test "every bun version-updates group is restricted to minor and patch releases" {
  # The #454 failure mode: a major bump riding inside a grouped PR fails the
  # whole batch. With every group limited to minor+patch, a major matches no
  # group and Dependabot opens it on its own.
  local rows
  rows="$(version_groups_of "$DEPENDABOT")"
  [ -n "$rows" ]
  while IFS='|' read -r name _patterns _excludes update_types; do
    if [ "$update_types" != 'minor,patch' ] && [ "$update_types" != 'patch,minor' ]; then
      echo "group $name admits update-types '$update_types'; expected exactly minor and patch" >&2
      return 1
    fi
  done <<< "$rows"
}

@test "the bun entry clusters version updates into more than one group" {
  # A single minor+patch catch-all would still bundle every minor into one PR
  # that one incompatible minor reddens. Clusters keep a red group small and
  # let the others merge.
  local count
  count="$(version_groups_of "$DEPENDABOT" | wc -l)"
  [ "$count" -gt 1 ]
}

@test "the catch-all version group is declared after every specific group" {
  # Dependabot assigns a dependency to the FIRST group it matches. A `*` group
  # ahead of a specific one silently swallows that cluster back into the
  # catch-all — the file would parse, the clusters would just never form.
  local rows last
  rows="$(version_groups_of "$DEPENDABOT")"
  last="$(printf '%s\n' "$rows" | tail -n 1)"
  # The last version group is the catch-all...
  [ "$(printf '%s' "$last" | cut -d'|' -f2)" = '*' ]
  # ...and no other version group uses the bare wildcard.
  local wildcard_count
  wildcard_count="$(printf '%s\n' "$rows" | cut -d'|' -f2 | grep -c '^\*$')"
  [ "$wildcard_count" -eq 1 ]
}

@test "every specific version group matches at least one direct dependency" {
  # Patterns rot when a package is renamed or dropped. A cluster whose patterns
  # match nothing in package.json is dead config that reads like coverage.
  local names
  names="$(direct_dependency_names "$PROJECT_ROOT/package.json")"
  local rows
  rows="$(version_groups_of "$DEPENDABOT")"
  while IFS='|' read -r name patterns _excludes _update_types; do
    [ "$patterns" != '*' ] || continue
    if ! printf '%s\n' "$names" | patterns_match_any "$patterns"; then
      echo "group $name matches no direct dependency: $patterns" >&2
      return 1
    fi
  done <<< "$rows"
}

@test "a group's exclude-patterns only name dependencies a sibling group claims" {
  # An exclusion exists to hand a dependency to another cluster. One that no
  # sibling group's patterns match would push that dependency into the
  # catch-all instead — a silent reassignment, not a routing decision.
  local rows
  rows="$(version_groups_of "$DEPENDABOT")"
  while IFS='|' read -r name patterns excludes _update_types; do
    [ "$excludes" != '-' ] || continue
    local excluded
    for excluded in ${excludes//,/ }; do
      local claimed=0
      while IFS='|' read -r other_name other_patterns _o_excl _o_types; do
        [ "$other_name" != "$name" ] || continue
        [ "$other_patterns" != '*' ] || continue
        if printf '%s\n' "$excluded" | patterns_match_any "$other_patterns"; then
          claimed=1
        fi
      done <<< "$rows"
      if [ "$claimed" -ne 1 ]; then
        echo "group $name excludes $excluded, which no sibling group claims" >&2
        return 1
      fi
    done
  done <<< "$rows"
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
  rows="$(groups_of "$mutated" bun /)"
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
  rows="$(groups_of "$mutated" bun /)"
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
  rows="$(groups_of "$mutated" bun /)"
  run assert_security_group_present "$rows"
  [ "$status" -ne 0 ]
  run grep -c 'applies-to: security-updates' "$mutated"
  [ "$output" -ge 1 ]
}

@test "a second bun entry elsewhere cannot vouch for the root entry's groups" {
  # The fail-open the directory filter closes: the '/' entry loses its security
  # group while a bun entry for another directory still declares both. Reading
  # groups from every bun entry would keep the presence check green even though
  # the root lockfile is no longer covered.
  local mutated="$BATS_TEST_TMPDIR/other-directory.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    const clone = JSON.parse(JSON.stringify(bun));
    clone.directory = "/src/test/load";
    for (const [name, g] of Object.entries(bun.groups)) {
      if (g["applies-to"] === "security-updates") delete bun.groups[name];
    }
    doc.updates.push(clone);
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  # The other entry really does carry the security group...
  local elsewhere
  elsewhere="$(groups_of "$mutated" bun /src/test/load)"
  assert_security_group_present "$elsewhere"

  # ...and the root entry, the one that matters, is red.
  local rows
  rows="$(groups_of "$mutated" bun /)"
  run assert_security_group_present "$rows"
  [ "$status" -ne 0 ]
}

# --- Negative: the version-group split must be detected when it regresses -----

@test "detects a version group that admits major releases" {
  local mutated="$BATS_TEST_TMPDIR/majors.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    const first = Object.values(bun.groups).find((g) => g["applies-to"] === "version-updates");
    delete first["update-types"];
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local rows
  rows="$(version_groups_of "$mutated")"
  # The group without update-types reads as admitting everything, majors included.
  printf '%s\n' "$rows" | cut -d'|' -f4 | grep -q '^-$'
}

@test "detects the version groups collapsed back into a single catch-all" {
  # The pre-#379 shape: one `*` group over every version update.
  local mutated="$BATS_TEST_TMPDIR/single-group.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    for (const [name, g] of Object.entries(bun.groups)) {
      if (g["applies-to"] === "version-updates") delete bun.groups[name];
    }
    bun.groups["js-all-updates"] = { "applies-to": "version-updates", patterns: ["*"] };
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  [ "$(version_groups_of "$mutated" | wc -l)" -eq 1 ]
}

@test "detects the catch-all declared ahead of a specific group" {
  local mutated="$BATS_TEST_TMPDIR/catch-all-first.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    const entries = Object.entries(bun.groups);
    const isCatchAll = ([, g]) =>
      g["applies-to"] === "version-updates" && Array.isArray(g.patterns) && g.patterns.join() === "*";
    const catchAll = entries.find(isCatchAll);
    bun.groups = Object.fromEntries([catchAll, ...entries.filter((e) => e !== catchAll)]);
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local last
  last="$(version_groups_of "$mutated" | tail -n 1)"
  [ "$(printf '%s' "$last" | cut -d'|' -f2)" != '*' ]
}

@test "detects a specific group whose patterns match no direct dependency" {
  local mutated="$BATS_TEST_TMPDIR/rotten-pattern.yml"
  node -e '
    const yaml = require(process.env.PROJECT_ROOT + "/node_modules/js-yaml");
    const fs = require("fs");
    const doc = yaml.load(fs.readFileSync(process.argv[1], "utf8"));
    const bun = doc.updates.find((u) => u["package-ecosystem"] === "bun");
    const first = Object.values(bun.groups).find(
      (g) => g["applies-to"] === "version-updates" && g.patterns.join() !== "*"
    );
    first.patterns = ["@vilnacrm/no-such-package-*"];
    fs.writeFileSync(process.argv[2], yaml.dump(doc));
  ' "$DEPENDABOT" "$mutated"

  local names rows
  names="$(direct_dependency_names "$PROJECT_ROOT/package.json")"
  rows="$(version_groups_of "$mutated")"
  local dead=0
  while IFS='|' read -r _name patterns _excludes _update_types; do
    [ "$patterns" != '*' ] || continue
    if ! printf '%s\n' "$names" | patterns_match_any "$patterns"; then
      dead=1
    fi
  done <<< "$rows"
  [ "$dead" -eq 1 ]
}

@test "the wildcard matcher is anchored, so a pattern cannot match by substring" {
  # `react` must not be satisfied by `react-dom`, or the rot check above could
  # be kept green by a neighbouring package after the named one is removed.
  run patterns_match_any 'react' <<< 'react-dom'
  [ "$status" -ne 0 ]
  run patterns_match_any 'react' <<< 'react'
  [ "$status" -eq 0 ]
  run patterns_match_any '@mui/*' <<< '@mui/material'
  [ "$status" -eq 0 ]
  run patterns_match_any '@mui/*' <<< '@emotion/react'
  [ "$status" -ne 0 ]
  # A regex metacharacter in a package name is matched literally.
  run patterns_match_any 'next.js' <<< 'nextxjs'
  [ "$status" -ne 0 ]
}
