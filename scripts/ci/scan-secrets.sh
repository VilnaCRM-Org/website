#!/usr/bin/env bash
# Scan for committed secrets with gitleaks (issue #353).
#
# Three modes, because they answer three different questions and must fail in
# three different places:
#
#   tree     the checked-out files only (`--no-git`). Cheap, deterministic, and
#            scoped to what the branch actually ships, so it gates every PR.
#   history  every commit reachable from the checkout. This is the mode that
#            catches a credential that was committed and then "removed" in a
#            later commit -- the working tree is clean, the object store is not.
#            It needs a full-depth clone, and it is deliberately NOT on the PR
#            leg: a finding in a 2024 commit is not the PR author's regression,
#            and blocking on it would only teach reviewers to click past a red
#            check. It runs weekly instead, and a failure routes to the
#            ci-health alert issue.
#   logs     a directory of downloaded CI job logs (LOG_DIR), scanned as plain
#            files (`--no-git`) against the same committed config (#375 F4). A
#            token fetched at run time is never a registered secret, so GitHub
#            never masks it; this is the mode that notices one printed by a
#            debug flag or an erroring step. An unset, missing or EMPTY log
#            directory is refused: a scan of nothing is a green check that
#            proves nothing.
#
# Like lint-workflows and lint-metrics, this drives a pinned external tool
# rather than an npm dependency. The gitleaks GitHub Action requires a paid
# licence for organizations, so the CLI container is run directly -- pinned BY
# DIGEST, so a repointed tag cannot change what a security gate enforces.
set -euo pipefail

image="${GITLEAKS_IMAGE:?GITLEAKS_IMAGE must be set (see the Makefile)}"
mode="${SECRETS_MODE:-tree}"
config="${GITLEAKS_CONFIG:-.gitleaks.toml}"
workspace="${GITHUB_WORKSPACE:-$PWD}"

# Enforce the digest pin the header promises rather than only documenting it.
# A tag -- or a truncated digest -- would let whatever the registry currently
# serves decide what this gate enforces, and the failure is silent: the scan
# still runs, still exits 0 on a clean tree, and still reports a green check
# while running an image nobody reviewed. Fail closed instead.
case "${image}" in
  *@sha256:*) ;;
  *)
    echo "scan-secrets: GITLEAKS_IMAGE '${image}' is not digest-pinned;" \
      "the gate must run an immutable image (expected <image>@sha256:<64 hex>)" >&2
    exit 1
    ;;
esac
digest="${image##*@sha256:}"
if [ "${#digest}" -ne 64 ] || [ -n "${digest//[0-9a-f]/}" ]; then
  echo "scan-secrets: GITLEAKS_IMAGE digest '${digest}' is not 64 lowercase hex characters" >&2
  exit 1
fi

if [ ! -f "${workspace}/${config}" ]; then
  echo "scan-secrets: config '${config}' not found under '${workspace}';" \
    "the scan must run against the committed allowlist, never gitleaks' bare defaults" >&2
  exit 1
fi

# Both arrays are declared empty up front. `"${arr[@]:-}"` on an unset array
# expands to one EMPTY argument, which docker would take as a positional -- so
# the default must be a genuinely empty array, not a `:-` fallback.
scope_args=()
git_env=()
log_mount=()
source_dir=/repo

case "${mode}" in
  tree) scope_args=(--no-git) ;;
  history)
    # gitleaks walks history with git, and in CI the checkout is owned by the
    # runner user while the container runs as root -- which git refuses as
    # "dubious ownership", with an exit code the scan would otherwise report as
    # a scanning failure. Pass the exemption through the environment so no shell
    # is needed inside the image.
    git_env+=(
      -e GIT_CONFIG_COUNT=1
      -e GIT_CONFIG_KEY_0=safe.directory
      -e GIT_CONFIG_VALUE_0=/repo
    )
    ;;
  logs)
    scope_args=(--no-git)
    source_dir=/logs
    ;;
  *)
    echo "scan-secrets: SECRETS_MODE must be 'tree', 'history' or 'logs', got '${mode}'" >&2
    exit 1
    ;;
esac

if [ "${mode}" = "history" ]; then
  if [ ! -d "${workspace}/.git" ]; then
    echo "scan-secrets: SECRETS_MODE=history needs a git directory at '${workspace}/.git'." \
      "In CI, check out with fetch-depth: 0." >&2
    exit 1
  fi
  # A shallow clone is the dangerous case, not the missing one: `.git` exists,
  # gitleaks runs, every commit it can see is clean, and the job reports green
  # while the history before the graft boundary was never opened. That is a
  # green check that proves nothing -- exactly what this leg exists to prevent
  # -- so ask git directly rather than trusting the workflow's fetch-depth.
  if [ "$(git -C "${workspace}" rev-parse --is-shallow-repository 2>/dev/null)" != "false" ]; then
    echo "scan-secrets: '${workspace}' is a shallow (or unreadable) git repository." \
      "A history scan there would silently skip every commit before the graft" \
      "boundary and pass vacuously. Check out with fetch-depth: 0." >&2
    exit 1
  fi
fi

if [ "${mode}" = "logs" ]; then
  log_dir="${LOG_DIR:-}"
  if [ -z "${log_dir}" ]; then
    echo "scan-secrets: SECRETS_MODE=logs needs LOG_DIR, the directory of downloaded job logs" >&2
    exit 1
  fi
  if [ ! -d "${log_dir}" ]; then
    echo "scan-secrets: LOG_DIR '${log_dir}' is not a directory" >&2
    exit 1
  fi
  # A failed or truncated download leaves the directory empty (or holding only
  # empty files), and gitleaks reports "no leaks found" over zero bytes -- the
  # vacuous pass this mode must never produce. Require at least one non-empty
  # regular file before spending a scan.
  if [ -z "$(find "${log_dir}" -type f -size +0c -print -quit)" ]; then
    echo "scan-secrets: LOG_DIR '${log_dir}' holds no non-empty file; refusing to report" \
      "a clean scan of nothing" >&2
    exit 1
  fi
  # Docker needs an absolute bind source, and read-only is enough: the scan
  # never writes into the logs it is judging.
  log_dir="$(cd "${log_dir}" && pwd -P)"
  log_mount=(-v "${log_dir}:/logs:ro")
fi

echo "scan-secrets: mode=${mode} config=${config}"
exec docker run --rm \
  -v "${workspace}:/repo" -w /repo \
  "${log_mount[@]}" \
  "${git_env[@]}" \
  "${image}" \
  detect --source "${source_dir}" "${scope_args[@]}" \
  --config "/repo/${config}" --redact --exit-code 1
