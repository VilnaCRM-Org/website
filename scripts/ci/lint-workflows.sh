#!/usr/bin/env bash
# Audit the GitHub Actions workflows with zizmor (issue #360).
#
# Workflow files are the one part of the repo that no other gate reads: ESLint,
# tsc, dependency-cruiser and the metrics gate all stop at src/, and the qlty
# `zizmor`/`actionlint` plugins are inert here because .qlty/qlty.toml excludes
# `.github/**` and every `*.yml`. So a workflow could hand a privileged token to
# a mutable action tag and nothing would say a word -- which is exactly the
# state #366 found.
#
# Like lint-metrics, this runs a pinned external tool rather than an npm dep.
# The CLI container is pinned BY DIGEST (not tag) so the gate is reproducible
# and a repointed tag cannot change what the security linter enforces.
set -euo pipefail

image="${ZIZMOR_IMAGE:?ZIZMOR_IMAGE must be set (see the Makefile)}"

# Enforce the digest pin the header above promises, rather than only documenting
# it. A tag -- or a truncated/garbled digest -- would let whatever the registry
# currently serves decide what this security gate enforces, and the failure is
# silent: a repointed tag still runs, still exits 0, and still reports a green
# check while auditing something nobody reviewed. Fail closed instead.
case "${image}" in
  *@sha256:*) ;;
  *)
    echo "lint-workflows: ZIZMOR_IMAGE '${image}' is not digest-pinned;" \
      "the gate must run an immutable image (expected <image>@sha256:<64 hex>)" >&2
    exit 1
    ;;
esac
digest="${image##*@sha256:}"
if [ "${#digest}" -ne 64 ] || [ -n "${digest//[0-9a-f]/}" ]; then
  echo "lint-workflows: ZIZMOR_IMAGE digest '${digest}' is not 64 lowercase hex characters" >&2
  exit 1
fi
targets="${ZIZMOR_TARGETS:-.github/workflows/}"
persona="${ZIZMOR_PERSONA:-regular}"
min_severity="${ZIZMOR_MIN_SEVERITY:-medium}"
min_confidence="${ZIZMOR_MIN_CONFIDENCE:-high}"
workspace="${GITHUB_WORKSPACE:-$PWD}"

# Some audits (ref-version-mismatch, known-vulnerable-actions, stale-action-refs)
# resolve tags against the GitHub API. In CI the job token is passed in; locally
# fall back to the gh CLI's token, and if neither is available run offline with
# a notice rather than failing -- an offline run is a strict subset of the CI
# run, so it can never pass something CI would reject.
token="${GH_TOKEN:-${GITHUB_TOKEN:-}}"
if [ -z "${token}" ] && command -v gh >/dev/null 2>&1; then
  token="$(gh auth token 2>/dev/null || true)"
fi

offline_args=()
if [ -z "${token}" ]; then
  echo "lint-workflows: no GH_TOKEN and no gh login; running --offline (online audits skipped)" >&2
  offline_args=(--offline)
fi

# Exported and forwarded by NAME. `-e GH_TOKEN=<value>` would place the credential
# in the docker process's argv, where any local user can read it out of `ps`.
export GH_TOKEN="${token}"

docker run --rm \
  -v "${workspace}:/repo:ro" \
  -w /repo \
  -e GH_TOKEN \
  "${image}" \
  --no-progress \
  --persona "${persona}" \
  --min-severity "${min_severity}" \
  --min-confidence "${min_confidence}" \
  "${offline_args[@]}" \
  "${targets}"
