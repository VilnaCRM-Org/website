#!/usr/bin/env sh
# Run the dependency-CVE gate (issue #356): scan bun.lock with osv-scanner and hand the JSON
# to scripts/ci/check-osv-report.ts for the verdict.
#
# Two modes, selected by OSV_MODE:
#   diff    (default, BLOCKING) scan the base ref's lockfile and the working tree's, then fail
#           only on advisories the working tree ADDS. See osv-report.ts for why the gate is
#           differential rather than absolute.
#   census  (ADVISORY) scan the working tree's lockfile only and report everything.
#
# osv-scanner is only ever asked to produce JSON here; every pass/fail decision belongs to the
# TypeScript checker, which is unit-tested. That split is what makes the gate verifiable —
# see src/test/unit/osv-report.test.ts.
set -eu

OSV_BIN="${OSV_BIN:-./bin/osv-scanner}"
OSV_MODE="${OSV_MODE:-diff}"
OSV_LOCKFILE="${OSV_LOCKFILE:-bun.lock}"
OSV_BASE_REF="${OSV_BASE_REF:-origin/main}"
# Kept under config/ beside metrics-policy.json, where this repository puts the policy files
# its gates read, rather than at the repository root. Every scan passes --config explicitly,
# so nothing relies on osv-scanner's root auto-discovery.
OSV_CONFIG="${OSV_CONFIG:-config/osv-scanner.toml}"
OSV_REPORT_DIR="${OSV_REPORT_DIR:-reports/osv}"

mkdir -p "$OSV_REPORT_DIR"

# osv-scanner exits 1 when it FINDS vulnerabilities — an expected outcome here, since the
# verdict is the checker's job. Anything else (127 general error, 128 no packages extracted)
# means the scan itself did not run, which must fail closed rather than be read as "clean".
scan() {
  scan_lockfile="$1"
  scan_out="$2"
  scan_config="$3"
  set +e
  "$OSV_BIN" scan source --lockfile="$scan_lockfile" --config="$scan_config" \
    --format=json >"$scan_out"
  scan_status=$?
  set -e
  if [ "$scan_status" -gt 1 ]; then
    printf 'ERROR: osv-scanner exited %s scanning "%s" — the scan did not complete.\n' \
      "$scan_status" "$scan_lockfile" >&2
    exit 1
  fi
}

if [ "$OSV_MODE" = 'diff' ]; then
  # Materialise the base branch's lockfile without touching the working tree, then tell
  # osv-scanner which parser to use for it: extraction is keyed on the file NAME, and the
  # temporary copy is not called bun.lock.
  base_copy="$OSV_REPORT_DIR/base.lock"
  if ! git show "$OSV_BASE_REF:$OSV_LOCKFILE" >"$base_copy" 2>/dev/null; then
    printf 'ERROR: cannot read "%s" at "%s". Fetch the base ref before running the gate.\n' \
      "$OSV_LOCKFILE" "$OSV_BASE_REF" >&2
    exit 1
  fi

  # BOTH scans run under the ignore policy that will be in force AFTER this merges: the
  # entries present in the base ref AND the working tree. Neither one-sided set can be
  # honoured — an ignore the change ADDS would let one diff carry a vulnerable dependency and
  # the excuse for it, and an ignore the change REMOVES would suppress an advisory that goes
  # live on merge. See scripts/ci/osv-ignores.ts.
  #
  # The working-tree config is still validated — the checker reads OSV_CONFIG for the
  # id/reason/ignoreUntil policy — it just does not decide what this run may suppress.
  base_config="$OSV_REPORT_DIR/base-config.toml"
  if ! git show "$OSV_BASE_REF:$OSV_CONFIG" >"$base_config" 2>/dev/null; then
    # No config on the base ref yet (the gate is new, or the path moved). An empty config is
    # the strictest reading: nothing is suppressed.
    : >"$base_config"
  fi

  effective_config="$OSV_REPORT_DIR/effective-config.toml"
  OSV_BASE_CONFIG="$base_config" OSV_CONFIG="$OSV_CONFIG" \
    OSV_EFFECTIVE_CONFIG="$effective_config" \
    bun x tsx scripts/ci/write-effective-osv-config.ts

  scan "$OSV_LOCKFILE" "$OSV_REPORT_DIR/head.json" "$effective_config"
  scan "$OSV_LOCKFILE:$base_copy" "$OSV_REPORT_DIR/base.json" "$effective_config"
  OSV_BASE_REPORT="$OSV_REPORT_DIR/base.json"
  OSV_BASE_CONFIG="$base_config"
  export OSV_BASE_REPORT OSV_BASE_CONFIG
else
  scan "$OSV_LOCKFILE" "$OSV_REPORT_DIR/head.json" "$OSV_CONFIG"
fi

OSV_HEAD_REPORT="$OSV_REPORT_DIR/head.json"
export OSV_HEAD_REPORT
export OSV_MODE
export OSV_CONFIG
exec bun x tsx scripts/ci/check-osv-report.ts
