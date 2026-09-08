#!/usr/bin/env bash
# Scan for committed secrets with gitleaks (issue #353).
#
# Two modes, because they answer two different questions and must fail in two
# different places:
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
  *)
    echo "scan-secrets: SECRETS_MODE must be 'tree' or 'history', got '${mode}'" >&2
    exit 1
    ;;
esac

if [ "${mode}" = "history" ] && [ ! -d "${workspace}/.git" ]; then
  echo "scan-secrets: SECRETS_MODE=history needs a git directory at '${workspace}/.git'." \
    "In CI, check out with fetch-depth: 0 -- a shallow clone would silently scan" \
    "only the tip commit and pass vacuously." >&2
  exit 1
fi

echo "scan-secrets: mode=${mode} config=${config}"
exec docker run --rm \
  -v "${workspace}:/repo" -w /repo \
  "${git_env[@]}" \
  "${image}" \
  detect --source /repo "${scope_args[@]}" \
  --config "/repo/${config}" --redact --exit-code 1
