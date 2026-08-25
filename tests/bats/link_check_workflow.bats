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
