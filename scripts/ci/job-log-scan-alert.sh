#!/usr/bin/env bash
# File the tracking issue for a job-log secret scan that did not pass (#375 F4).
# Run by .github/workflows/job-log-secrets-alert.yml and driven by
# tests/bats/secrets_scanning.bats against a stubbed gh.
#
# WHY NOT ci-health-alerts.yml -- that workflow tracks a workflow's HEALTH: it
# files "'<name>' workflow is failing" and closes it as soon as the latest run on
# main is green. The log scan runs after every privileged run, the pull-request
# sandbox pair included, so the next unrelated clean scan would close a
# leaked-credential alert minutes later, before anyone rotated anything. A
# later clean scan says nothing about an earlier run's logs. So this issue is
# per scanned run, and NOTHING closes it automatically: a human closes it once
# the credential is rotated and the logs are deleted. There is deliberately no
# close call in this script, and the bats suite pins that.
#
# The scan run's title (its `run-name`) names what it scanned -- "... - run
# <id>" or "... - weekly backstop". It is parsed against those two exact shapes
# and anything else falls back to the scan run's own id, so a dispatch input
# can never write free text into an issue title.
#
# Inputs (environment):
#   SCAN_TITLE       display title of the scan run
#   SCAN_RUN_ID      numeric id of the scan run
#   SCAN_CONCLUSION  its conclusion (failure, timed_out, cancelled, ...)
#   GH_REPO          owner/name (falls back to GITHUB_REPOSITORY)
#
# Requires: gh (authenticated through GH_TOKEN, with issues: write) and jq.
set -euo pipefail

REPO="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
SCAN_TITLE="${SCAN_TITLE:-}"
SCAN_RUN_ID="${SCAN_RUN_ID:-}"
SCAN_CONCLUSION="${SCAN_CONCLUSION:-}"
SERVER_URL="${GITHUB_SERVER_URL:-https://github.com}"
LABEL="${ALERT_LABEL:-ci-alert}"

fail() {
  printf 'job-log-scan-alert: %s\n' "$*" >&2
  exit 2
}

[[ "${REPO}" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] ||
  fail "GH_REPO or GITHUB_REPOSITORY must be owner/name, got '${REPO}'"
[[ "${SCAN_RUN_ID}" =~ ^[0-9]+$ ]] || fail "SCAN_RUN_ID must be a numeric run id, got '${SCAN_RUN_ID}'"
[[ "${SCAN_CONCLUSION}" =~ ^[a-z_]+$ ]] || fail "SCAN_CONCLUSION must be a run conclusion, got '${SCAN_CONCLUSION}'"
export GH_REPO="${REPO}"

runs_url="${SERVER_URL}/${REPO}/actions/runs"
scan_url="${runs_url}/${SCAN_RUN_ID}"
scanned=''
if [[ "${SCAN_TITLE}" =~ ^job\ log\ secrets\ scan\ -\ run\ ([0-9]+)$ ]]; then
  scanned="${BASH_REMATCH[1]}"
  title="Secret scan of job logs failed for run ${scanned}"
  subject="the job logs of run ${runs_url}/${scanned}"
elif [ "${SCAN_TITLE}" = 'job log secrets scan - weekly backstop' ]; then
  title='Secret scan of job logs failed for the weekly backstop'
  subject='the job logs of the last week of privileged runs (the finding names the run directory)'
else
  title="Secret scan of job logs failed for scan run ${SCAN_RUN_ID}"
  subject='the job logs named in the scan run'
fi

if [ -n "${scanned}" ]; then
  rescan="gh workflow run job-log-secrets-scan.yml -f run_id=${scanned}"
  delete_logs="gh api -X DELETE repos/${REPO}/actions/runs/${scanned}/logs"
else
  rescan='gh workflow run job-log-secrets-scan.yml -f run_id=<id>'
  delete_logs="gh api -X DELETE repos/${REPO}/actions/runs/<id>/logs"
fi

body="$(
  cat <<EOF
The job-log secret scan of ${subject} ended \`${SCAN_CONCLUSION}\`: ${scan_url}

Either gitleaks found a credential in the logs (the scan step prints each finding redacted, with the file it came from), or the logs could not be read. Neither is a clean result.

- **A finding**: treat it as a live credential. Rotate and revoke it upstream, then delete the run's logs (\`${delete_logs}\`).
- **The logs could not be read**: re-run the scan once the cause is fixed (\`${rescan}\`).

Nothing closes this issue automatically -- a later clean scan says nothing about these logs. Close it by hand once the credential is rotated and the logs are gone, or once a re-scan passes.
EOF
)"

# Exact-title match: `--search` is a fuzzy word match, and the title reaches jq
# as data through --arg.
existing="$(gh issue list --label "${LABEL}" --state open --search "${title} in:title" \
  --json number,title | jq -r --arg t "${title}" 'map(select(.title == $t)) | .[0].number // empty')"

if [ -n "${existing}" ]; then
  gh issue comment "${existing}" --body "Failed again (\`${SCAN_CONCLUSION}\`): ${scan_url}" >/dev/null
  printf 'job-log-scan-alert: commented on #%s\n' "${existing}"
else
  # Idempotent: gh issue create rejects an unknown label.
  gh label create "${LABEL}" --color B60205 \
    --description 'Deploy/release/red-main CI health alerts' >/dev/null 2>&1 || true
  gh issue create --label "${LABEL}" --title "${title}" --body "${body}" >/dev/null
  printf "job-log-scan-alert: created '%s'\n" "${title}"
fi
