#!/usr/bin/env bash
#
# Choose where CI fetches the dev image's base from (issues #509, #506).
#
# The Dockerfile's `base` stage is pinned by digest on ECR Public. ECR Public caps
# anonymous pulls per source IP, and GitHub's shared runner pool exhausts that cap:
# the refusal is `429 toomanyrequests: Data limit exceeded`, a quota rather than a
# burst, so waiting for it to clear does not work. Because the FROM line carries
# the manifest digest, the same bytes can be fetched from any registry that holds
# that digest — the digest is what identifies the image, not the host it came from.
#
# This script reads the ONE `FROM <ref> AS base` line and derives, mechanically,
# the Docker Hub pull-through mirror ref for the same digest:
#
#   public.ecr.aws/docker/library/<name>[:<tag>]@sha256:<64 hex>
#     -> mirror.gcr.io/library/<name>@sha256:<same 64 hex>
#
# and a BuildKit named build context that redirects the FROM ref to it. It fails
# closed on anything else — a tag-only ref, a Docker Hub ref, a registry other
# than ECR Public, a path outside `docker/library`, a short or missing digest, a
# `--platform` flag, a continued line, zero or several `AS base` stages — because
# the `docker/library` equivalence is only established for ECR Public, and a
# derivation that fell back to a tag would trade integrity for availability.
# The Dockerfile itself is never rewritten; the mirror is a CI transport only.
#
# Usage:
#   scripts/ci/base-image-source.sh [--probe] [DOCKERFILE]
#
# DOCKERFILE defaults to ./Dockerfile. Output, one `key=value` per line, is
# appended to $GITHUB_OUTPUT when it is set and printed on stdout otherwise:
#
#   ref=<the FROM ref, verbatim>
#   mirror=<the digest-pinned mirror ref>
#   mirror-contexts=<ref>=docker-image://<mirror>
#
# With --probe it also asks ECR Public for the manifest (bounded by
# PROBE_TIMEOUT seconds, default 60) and adds:
#
#   source=origin|mirror
#   build-contexts=<empty when ECR Public answered, else the mirror context>
#
# A refused probe is not an error: it prints the registry's own error text as a
# workflow warning on stderr and selects the mirror. Exit 1 means the Dockerfile
# does not satisfy the contract above; exit 2 is a usage error.

set -euo pipefail

ORIGIN_PREFIX='public.ecr.aws/docker/library/'
MIRROR_PREFIX='mirror.gcr.io/library/'
REF_PATTERN='^public\.ecr\.aws/docker/library/[a-z0-9]+(([._]|__|-+)[a-z0-9]+)*(:[A-Za-z0-9_][A-Za-z0-9_.-]{0,127})?@sha256:[0-9a-f]{64}$'
BASE_LINE_PATTERN='^[[:space:]]*[Ff][Rr][Oo][Mm][[:space:]]+([^[:space:]]+)[[:space:]]+[Aa][Ss][[:space:]]+[Bb][Aa][Ss][Ee][[:space:]]*$'

fail() {
  printf '::error::%s\n' "$*" >&2
  exit 1
}

usage() {
  printf 'usage: %s [--probe] [DOCKERFILE]\n' "$0" >&2
  exit 2
}

# Workflow-command escaping: the registry's error text is untrusted, and an
# unescaped newline would let it start a second `::command::` line.
escape_message() {
  local message="$1"
  message="${message//'%'/%25}"
  message="${message//$'\r'/%0D}"
  message="${message//$'\n'/%0A}"
  printf '%s' "${message}"
}

emit() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    printf '%s=%s\n' "$1" "$2" >>"${GITHUB_OUTPUT}"
  else
    printf '%s=%s\n' "$1" "$2"
  fi
}

probe=0
dockerfile=''
for arg in "$@"; do
  case "${arg}" in
    --probe) probe=1 ;;
    -*) usage ;;
    *)
      [ -z "${dockerfile}" ] || usage
      dockerfile="${arg}"
      ;;
  esac
done
dockerfile="${dockerfile:-Dockerfile}"

[ -f "${dockerfile}" ] || fail "no Dockerfile at ${dockerfile}"

refs=()
while IFS= read -r line || [ -n "${line}" ]; do
  line="${line%$'\r'}"
  if [[ "${line}" =~ ${BASE_LINE_PATTERN} ]]; then
    refs+=("${BASH_REMATCH[1]}")
  fi
done <"${dockerfile}"

[ "${#refs[@]}" -gt 0 ] ||
  fail "${dockerfile} has no single-line 'FROM <image> AS base' instruction"
[ "${#refs[@]}" -eq 1 ] ||
  fail "${dockerfile} declares ${#refs[@]} 'AS base' stages; expected exactly one"

ref="${refs[0]}"
[[ "${ref}" =~ ${REF_PATTERN} ]] ||
  fail "the base image '${ref}' is not ${ORIGIN_PREFIX}<name>[:<tag>]@sha256:<64 hex>; refusing to derive a mirror for it"

digest="${ref##*@sha256:}"
name="${ref#"${ORIGIN_PREFIX}"}"
name="${name%%[:@]*}"
mirror="${MIRROR_PREFIX}${name}@sha256:${digest}"
mirror_contexts="${ref}=docker-image://${mirror}"

emit ref "${ref}"
emit mirror "${mirror}"
emit mirror-contexts "${mirror_contexts}"

[ "${probe}" -eq 1 ] || exit 0

if error_text="$(timeout "${PROBE_TIMEOUT:-60}" docker buildx imagetools inspect --raw "${ref}" 2>&1 >/dev/null)"; then
  emit source origin
  emit build-contexts ''
  exit 0
else
  status=$?
fi

[ -n "${error_text}" ] || error_text="no error text (exit ${status})"
[ "${status}" -ne 124 ] || error_text="no answer within ${PROBE_TIMEOUT:-60}s"
printf '::warning::%s\n' "$(escape_message "ECR Public refused the base image manifest, so this build fetches the digest-identical ${mirror} instead. Registry said: ${error_text:0:2000}")" >&2
emit source mirror
emit build-contexts "${mirror_contexts}"
