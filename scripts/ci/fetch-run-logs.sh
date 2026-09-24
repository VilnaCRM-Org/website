#!/usr/bin/env bash
# Download workflow-run job logs for the job-log secret scan (#375 F4).
#
# Run by .github/workflows/job-log-secrets-scan.yml right before
# `make scan-secrets-logs`, and driven by tests/bats/secrets_scanning.bats
# against a stubbed gh. It lives in a script rather than an inline `run:` block
# so every refusal below is provable at PR time.
#
# Two modes, exactly one of which must be selected:
#
#   RUN_ID              one run: the workflow_run that just completed, or the
#                       run a workflow_dispatch names.
#   BACKSTOP_WORKFLOWS  the weekly backstop: every completed run of these
#                       workflow files created in the last BACKSTOP_DAYS days
#                       (default 8 -- a day of overlap with the previous week).
#                       It re-reads what the per-run scans already read, so a
#                       dropped workflow_run delivery, or a scan that died and
#                       was never re-dispatched, cannot leave a run unread.
#
# Each run with logs is extracted into LOG_DIR/<run id>/, so a finding names
# the run it came from.
#
# A RUN THAT NEVER RAN A JOB WROTE NO LOGS -- a run cancelled while it was
# still pending (a newer run queued behind it on a concurrency group), a
# startup failure, or a fork run awaiting approval. GitHub still answers its
# logs endpoint with HTTP 200 and an empty 22-byte zip, which unzip refuses. So
# the run's jobs are read first: a run where no job executed a step is reported
# and skipped. Once a job has run, every problem below is a run whose logs
# could not be read -- an expired archive, a revoked token, a 5xx, an empty or
# unreadable zip -- and a scan that could not read the logs must never report
# them clean:
#
#   * RUN_ID exits non-zero on the spot; that run is the whole answer.
#   * The backstop records the run, keeps fetching the others, and exits
#     non-zero at the end, naming every run it could not read. Stopping at the
#     first one would leave every run listed after it unscanned for the week.
#     The workflow still scans what was fetched, so the job ends red either way.
#
# The backstop skips one more case: a run whose logs endpoint answers HTTP 404
# or 410 after its jobs listed fine. Those logs were deleted -- the documented
# response to a finding -- or expired, and logs that no longer exist cannot
# leak. Without this, the Monday after a leak was cleaned up would fail again
# on the very run that was fixed. The per-run mode still fails on it.
#
# Output, appended to $GITHUB_OUTPUT when it is set: `logs=present` when at
# least one run's logs were extracted, else `logs=none`, and `unreadable=` the
# space-separated ids of the runs that could not be read (backstop only). The
# workflow skips the scan only on an explicit `none`, so a missing output still
# scans -- and the scan then refuses the empty directory.
#
# Inputs (environment):
#   RUN_ID / BACKSTOP_WORKFLOWS / BACKSTOP_DAYS  as above
#   LOG_DIR  directory to extract into; must be absent or empty, so logs left
#            behind by another run can never be scanned as this one's
#   GH_REPO  owner/name (falls back to GITHUB_REPOSITORY)
#
# Requires: gh (authenticated through GH_TOKEN, with actions: read), unzip and
# GNU date.
set -euo pipefail

repo="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
run_id="${RUN_ID:-}"
backstop="${BACKSTOP_WORKFLOWS:-}"
days="${BACKSTOP_DAYS:-8}"
log_dir="${LOG_DIR:-}"

fail() {
  printf 'fetch-run-logs: %s\n' "$*" >&2
  exit 1
}

note() {
  printf 'fetch-run-logs: %s\n' "$*"
}

# Every value below is spliced into an API path, so it is validated as data
# first: a run id carrying `/` or `..` would address a different endpoint.
[[ "${repo}" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] ||
  fail "GH_REPO or GITHUB_REPOSITORY must be owner/name, got '${repo}'"
if [ -n "${run_id}" ] && [ -n "${backstop}" ]; then
  fail "set RUN_ID or BACKSTOP_WORKFLOWS, not both"
fi
if [ -n "${backstop}" ]; then
  [[ "${days}" =~ ^[1-9][0-9]*$ ]] || fail "BACKSTOP_DAYS must be a positive number, got '${days}'"
  for workflow in ${backstop}; do
    [[ "${workflow}" =~ ^[A-Za-z0-9._-]+\.ya?ml$ ]] ||
      fail "BACKSTOP_WORKFLOWS must list workflow file names, got '${workflow}'"
  done
else
  [[ "${run_id}" =~ ^[0-9]+$ ]] || fail "RUN_ID must be a numeric run id, got '${run_id}'"
fi
[ -n "${log_dir}" ] || fail "LOG_DIR must name the directory to extract into"
if [ -e "${log_dir}" ]; then
  [ -d "${log_dir}" ] || fail "LOG_DIR '${log_dir}' exists and is not a directory"
  [ -z "$(find "${log_dir}" -mindepth 1 -print -quit)" ] ||
    fail "LOG_DIR '${log_dir}' is not empty; refusing to mix in another run's logs"
fi
mkdir -p "${log_dir}"

archive="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/run-logs.XXXXXX")"
errors="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/run-logs-errors.XXXXXX")"
trap 'rm -f "${archive}" "${errors}"' EXIT

# Number of the run's jobs that executed at least one step. A skipped job has a
# start time but no steps, and a job that never got a runner has neither.
# --paginate prints one count per page, so the pages are summed, and anything
# that is not a count fails rather than reading as zero.
jobs_that_ran() {
  local counts
  counts="$(gh api --paginate "repos/${repo}/actions/runs/$1/jobs?per_page=100" \
    --jq '[.jobs[] | select((.steps // []) | length > 0)] | length')" ||
    fail "could not list the jobs of run $1 in ${repo}"
  printf '%s\n' "${counts}" |
    awk '!/^[0-9]+$/ { bad = 1 } { total += $1 } END { if (bad || NR == 0) exit 1; print total }' ||
    fail "unexpected job listing for run $1: '${counts}'"
}

fetched=0
unreadable=''

# A run whose logs could not be read. The reason is printed already (by
# jobs_that_ran's own fail) or passed here.
unreadable_run() {
  local id="$1" reason="${2:-}"
  [ -z "${reason}" ] || printf 'fetch-run-logs: %s\n' "${reason}" >&2
  [ -n "${backstop}" ] || exit 1
  unreadable="${unreadable:+${unreadable} }${id}"
}

fetch_run() {
  local id="$1" dest="${log_dir}/$1" ran count
  ran="$(jobs_that_ran "${id}")" || {
    unreadable_run "${id}"
    return 0
  }
  if [ "${ran}" -eq 0 ]; then
    note "run ${id} never ran a job, so it wrote no logs; nothing to scan"
    return 0
  fi
  # The endpoint answers with a redirect to a short-lived archive URL; gh
  # follows it, writes the zip to stdout, and exits non-zero on any HTTP error,
  # printing `gh: <message> (HTTP <status>)` or `gh: HTTP <status>`. A status
  # it words any other way is read as unreadable, never as gone.
  if ! gh api "repos/${repo}/actions/runs/${id}/logs" >"${archive}" 2>"${errors}"; then
    cat "${errors}" >&2
    if [ -n "${backstop}" ] && grep -Eq '(^|[( ])HTTP (404|410)([^0-9]|$)' "${errors}"; then
      note "run ${id}: its logs are gone (deleted or expired); nothing left to scan"
      return 0
    fi
    unreadable_run "${id}" "could not download the logs of run ${id} from ${repo}"
    return 0
  fi
  [ -s "${archive}" ] || {
    unreadable_run "${id}" "the log archive of run ${id} is empty"
    return 0
  }
  mkdir -p "${dest}"
  unzip -q "${archive}" -d "${dest}" || {
    unreadable_run "${id}" "the log archive of run ${id} is not a readable zip, though ${ran} job(s) ran"
    return 0
  }
  count="$(find "${dest}" -type f | wc -l | tr -d ' ')"
  [ "${count}" -gt 0 ] || {
    unreadable_run "${id}" "the log archive of run ${id} held no files"
    return 0
  }
  note "run ${id}: ${count} log file(s) in ${dest}"
  fetched=$((fetched + 1))
}

if [ -n "${backstop}" ]; then
  since="$(date -u -d "${days} days ago" +%Y-%m-%d)"
  listed=0
  for workflow in ${backstop}; do
    ids="$(gh api --paginate \
      "repos/${repo}/actions/workflows/${workflow}/runs?status=completed&created=%3E%3D${since}&per_page=100" \
      --jq '.workflow_runs[].id')" ||
      fail "could not list the runs of ${workflow} in ${repo}"
    note "${workflow}: $(printf '%s' "${ids}" | grep -c . || true) completed run(s) since ${since}"
    for id in ${ids}; do
      [[ "${id}" =~ ^[0-9]+$ ]] || fail "unexpected run id '${id}' listed for ${workflow}"
      listed=$((listed + 1))
      fetch_run "${id}"
    done
  done
  note "backstop: ${fetched} of ${listed} run(s) had logs"
else
  fetch_run "${run_id}"
fi

state=none
[ "${fetched}" -eq 0 ] || state=present
if [ -n "${GITHUB_OUTPUT:-}" ]; then
  printf 'logs=%s\nunreadable=%s\n' "${state}" "${unreadable}" >>"${GITHUB_OUTPUT}"
fi
note "logs=${state}"
[ -z "${unreadable}" ] ||
  fail "could not read the logs of run(s) ${unreadable}; re-scan each once the cause is fixed:" \
    "gh workflow run job-log-secrets-scan.yml -f run_id=<id>"
