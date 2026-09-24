#!/usr/bin/env bash
# Download one workflow run's job logs for the job-log secret scan (#375 F4).
#
# Run by .github/workflows/job-log-secrets-scan.yml right before
# `make scan-secrets-logs`, and driven by tests/bats/secrets_scanning.bats
# against a stubbed gh. It lives in a script rather than an inline `run:` block
# so every refusal below is provable at PR time.
#
# FAIL CLOSED -- every problem exits non-zero. A scan that could not read the
# logs must never report them clean: an expired archive, a revoked token or a
# mistyped run id all have to redden the job, not skip it.
#
# Inputs (environment):
#   RUN_ID   numeric id of the run whose logs to fetch
#   LOG_DIR  directory to extract into; must be absent or empty, so logs left
#            behind by another run can never be scanned as this one's
#   GH_REPO  owner/name (falls back to GITHUB_REPOSITORY)
#
# Requires: gh (authenticated through GH_TOKEN, with actions: read) and unzip.
set -euo pipefail

repo="${GH_REPO:-${GITHUB_REPOSITORY:-}}"
run_id="${RUN_ID:-}"
log_dir="${LOG_DIR:-}"

fail() {
  printf 'fetch-run-logs: %s\n' "$*" >&2
  exit 1
}

# Both values are spliced into an API path, so they are validated as data
# first: a run id carrying `/` or `..` would address a different endpoint.
[[ "${repo}" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]] ||
  fail "GH_REPO or GITHUB_REPOSITORY must be owner/name, got '${repo}'"
[[ "${run_id}" =~ ^[0-9]+$ ]] || fail "RUN_ID must be a numeric run id, got '${run_id}'"
[ -n "${log_dir}" ] || fail "LOG_DIR must name the directory to extract into"
if [ -e "${log_dir}" ]; then
  [ -d "${log_dir}" ] || fail "LOG_DIR '${log_dir}' exists and is not a directory"
  [ -z "$(find "${log_dir}" -mindepth 1 -print -quit)" ] ||
    fail "LOG_DIR '${log_dir}' is not empty; refusing to mix in another run's logs"
fi
mkdir -p "${log_dir}"

archive="$(mktemp "${RUNNER_TEMP:-${TMPDIR:-/tmp}}/run-logs.XXXXXX")"
trap 'rm -f "${archive}"' EXIT

# The endpoint answers with a redirect to a short-lived archive URL; gh follows
# it and writes the zip to stdout, and exits non-zero on any HTTP error.
gh api "repos/${repo}/actions/runs/${run_id}/logs" >"${archive}" ||
  fail "could not download the logs of run ${run_id} from ${repo}"
[ -s "${archive}" ] || fail "the log archive of run ${run_id} is empty"
unzip -q "${archive}" -d "${log_dir}" || fail "the log archive of run ${run_id} is not a readable zip"

count="$(find "${log_dir}" -type f | wc -l | tr -d ' ')"
[ "${count}" -gt 0 ] || fail "the log archive of run ${run_id} held no files"
printf 'fetch-run-logs: run %s: %s log file(s) in %s\n' "${run_id}" "${count}" "${log_dir}"
